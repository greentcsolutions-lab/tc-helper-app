// src/app/api/parse/extract/[parseId]/route.ts
// OPTIMIZED: Renders ONLY critical pages at 290 DPI, runs extractor, full cleanup

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { del } from "@vercel/blob";
import { renderPdfToPngZipUrl, downloadAndExtractZip } from "@/lib/pdf/renderer";
import { extractFromCriticalPages } from "@/lib/extractor/extractor";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: { parseId: string } }
) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return new Response("Unauthorized", { status: 401 });

  const { parseId } = params;

  const parse = await db.parse.findUnique({
    where: { id: parseId },
    select: {
      id: true,
      userId: true,
      renderZipUrl: true,
      renderZipKey: true,
      pdfBuffer: true,
      status: true,
      criticalPageNumbers: true,
    },
  });

  if (!parse || parse.status !== "READY_FOR_EXTRACT") {
    return new Response("Parse not ready for extraction", { status: 400 });
  }

  if (!parse.pdfBuffer) {
    return new Response("Original PDF not found", { status: 500 });
  }

  if (!parse.criticalPageNumbers || parse.criticalPageNumbers.length === 0) {
    return new Response("No critical pages identified", { status: 500 });
  }

  try {
    console.log(`[extract:${parseId}] Rendering ${parse.criticalPageNumbers.length} critical pages at 290 DPI`);

    // COST OPTIMIZATION: Render ONLY critical pages at high DPI
    const { url: extractZipUrl, key: extractZipKey } = await renderPdfToPngZipUrl(
      parse.pdfBuffer,
      { 
        pages: parse.criticalPageNumbers,  // Only the 4-9 critical pages
        dpi: 290  // High quality for extraction
      }
    );

    const criticalPagesHighDpi = await downloadAndExtractZip(extractZipUrl);

    console.log(`[extract:${parseId}] Running extractor on ${criticalPagesHighDpi.length} pages`);

    // Run Grok extraction
    const firstPass = await extractFromCriticalPages(criticalPagesHighDpi);

    // Optional: Second pass if confidence is low
    let finalResult = firstPass;
    const needsSecondPass = 
      firstPass.confidence.overall_confidence < 80 || 
      firstPass.handwriting_detected;

    if (needsSecondPass) {
      console.log(`[extract:${parseId}] Low confidence detected – running second pass`);
      const secondPass = await extractFromCriticalPages(
        criticalPagesHighDpi,
        firstPass.raw  // Pass previous result for refinement
      );
      finalResult = secondPass;
    }

    const needsReview = 
      finalResult.confidence.overall_confidence < 80 ||
      finalResult.handwriting_detected ||
      (finalResult.confidence.purchase_price || 0) < 90 ||
      (finalResult.confidence.buyer_names || 0) < 90;

    console.log(`[extract:${parseId}] Extraction complete – confidence: ${finalResult.confidence.overall_confidence}% – needs review: ${needsReview}`);

    // === CLEANUP: Delete ALL temporary files ===
    const cleanupTasks = [];

    // 1. Delete preview ZIP (9 pages @ 290 DPI from upload)
    if (parse.renderZipKey) {
      cleanupTasks.push(
        del(parse.renderZipKey)
          .then(() => console.log(`[extract:${parseId}] Preview ZIP deleted`))
          .catch((err) => console.warn(`[extract:${parseId}] Preview ZIP delete failed:`, err))
      );
    }

    // 2. Delete extraction ZIP (critical pages @ 290 DPI)
    cleanupTasks.push(
      del(extractZipKey)
        .then(() => console.log(`[extract:${parseId}] Extraction ZIP deleted`))
        .catch((err) => console.warn(`[extract:${parseId}] Extraction ZIP delete failed:`, err))
    );

    // 3. Clear original PDF buffer from database
    cleanupTasks.push(
      db.parse.update({
        where: { id: parseId },
        data: { pdfBuffer: null },
      })
    );

    await Promise.allSettled(cleanupTasks);

    // Final DB update with extracted data
    await db.parse.update({
      where: { id: parseId },
      data: {
        status: needsReview ? "NEEDS_REVIEW" : "COMPLETED",
        rawJson: finalResult.raw,
        formatted: finalResult.extracted,
        renderZipUrl: null,
        renderZipKey: null,
        finalizedAt: new Date(),
      },
    });

    console.log(`[extract:${parseId}] ✓ Complete – status: ${needsReview ? "NEEDS_REVIEW" : "COMPLETED"}`);

    return Response.json({
      success: true,
      needsReview,
      extracted: finalResult.extracted,
      confidence: finalResult.confidence,
      handwritingDetected: finalResult.handwriting_detected,
    });
  } catch (error: any) {
    console.error(`[extract:${parseId}] Failed:`, error);
    
    // Update status to failed
    await db.parse.update({
      where: { id: parseId },
      data: {
        status: "EXTRACTION_FAILED",
        errorMessage: error.message,
      },
    }).catch(err => console.error("Failed to update error status:", err));

    return Response.json(
      { error: "Extraction failed", message: error.message },
      { status: 500 }
    );
  }
}