// src/app/api/parse/process/[parseId]/route.ts
// Version: 2.2.0 - Added pdf-lib page count for exact all-pages classification render
// COMPLETE PIPELINE with SSE streaming for live updates
// 1. Render all pages @ 100 DPI → DEDUCT CREDIT HERE
// 2. Classify critical pages with Grok
// 3. Render critical pages @ 290 DPI
// 4. Extract with Grok
// 5. Stream results + critical page URLs

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { renderPdfToPngZipUrl, downloadAndExtractZip } from "@/lib/pdf/renderer";
import { classifyCriticalPages } from "@/lib/extractor/classifier";
import { extractFromCriticalPages } from "@/lib/extractor/extractor";
import { PDFDocument } from "pdf-lib"; // ← NEW: for exact page count

export const runtime = "nodejs";
export const maxDuration = 60;

function emit(controller: ReadableStreamDefaultController, data: any) {
  controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ parseId: string }> }
) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return new Response("Unauthorized", { status: 401 });

  const { parseId } = await params;

  const parse = await db.parse.findUnique({
    where: { id: parseId },
    select: {
      id: true,
      userId: true,
      pdfBuffer: true,
      status: true,
      fileName: true,
    },
  });

  if (!parse || parse.status !== "PENDING") {
    return Response.json({ error: "Parse not ready" }, { status: 400 });
  }

  if (!parse.pdfBuffer) {
    return Response.json({ error: "PDF not found" }, { status: 500 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // NEW: Get exact page count with pdf-lib (fast, in-memory)
        const pdfDoc = await PDFDocument.load(parse.pdfBuffer);
        const pageCount = pdfDoc.getPageCount();
        console.log(`[process:${parseId}] PDF loaded - ${pageCount} pages detected`);

        // PHASE 1: Low-res classification render (ALL pages exact)
        emit(controller, {
          type: "progress",
          message: "Rendering all pages at low resolution...",
          stage: "classify_render",
        });

        const { url: classifyZipUrl, key: classifyZipKey } = await renderPdfToPngZipUrl(
          parse.pdfBuffer,
          { dpi: 160, maxPages: pageCount } // ← 160 DPI for readable footers
        );

        const allPagesLowRes = await downloadAndExtractZip(classifyZipUrl);

        // ✅ DEDUCT CREDIT HERE - Nutrient render + download succeeded
        // This prevents abuse of free retries if they cancel before extraction completes
        // If Grok fails later, user still consumed Nutrient resources (fair charge)
        await db.user.update({
          where: { id: parse.userId },
          data: { credits: { decrement: 1 } },
        });
        console.log(`[process:${parseId}] ✓ Credit deducted - user has ${allPagesLowRes.length} rendered pages`);

        emit(controller, {
          type: "progress",
          message: `Analyzing ${allPagesLowRes.length} pages with AI vision model...`,
          stage: "classify_ai",
        });

        // PHASE 2: Grok classification with page count
        const { criticalPageNumbers, state } = await classifyCriticalPages(
          allPagesLowRes,
          pageCount // ← Pass total page count for validation
        );

        emit(controller, {
          type: "progress",
          message: `Found ${criticalPageNumbers.length} critical pages - rendering at high quality...`,
          stage: "extract_render",
          criticalPageNumbers,
        });

        // PHASE 3: Extract critical pages into new PDF, then render
        console.log(`[process:${parseId}] Creating new PDF with pages: [${criticalPageNumbers.join(", ")}]`);

        // Create a new PDF with ONLY the critical pages
        const newPdf = await PDFDocument.create();
        const sourcePdf = await PDFDocument.load(parse.pdfBuffer);

        // Copy each critical page to the new PDF (maintains original order)
        for (const pageNum of criticalPageNumbers) {
          const [copiedPage] = await newPdf.copyPages(sourcePdf, [pageNum - 1]);
          newPdf.addPage(copiedPage);
        }

        const criticalPagesPdfBuffer = Buffer.from(await newPdf.save());
        console.log(`[process:${parseId}] ✓ Extracted ${criticalPageNumbers.length} pages into new PDF (${(criticalPagesPdfBuffer.length / 1024).toFixed(0)} KB)`);

        // Render the new PDF at high quality
        const { url: extractZipUrl, key: extractZipKey } = await renderPdfToPngZipUrl(
          criticalPagesPdfBuffer,
          { dpi: 290, maxPages: criticalPageNumbers.length } // Render all pages of this new PDF
        );

        const criticalPagesHighRes = await downloadAndExtractZip(extractZipUrl);

        emit(controller, {
          type: "progress",
          message: "Extracting contract terms with Grok...",
          stage: "extract_ai",
        });

        // PHASE 4: Grok extraction
        const firstPass = await extractFromCriticalPages(criticalPagesHighRes);

        // Optional second pass if confidence is low
        let finalResult = firstPass;
        const needsSecondPass =
          firstPass.confidence.overall_confidence < 80 ||
          firstPass.handwriting_detected;

        if (needsSecondPass) {
          emit(controller, {
            type: "progress",
            message: "Low confidence detected - running second extraction pass...",
            stage: "extract_ai_boost",
          });

          const secondPass = await extractFromCriticalPages(
            criticalPagesHighRes,
            firstPass.raw
          );
          finalResult = secondPass;
        }

        const needsReview =
          finalResult.confidence.overall_confidence < 80 ||
          finalResult.handwriting_detected ||
          (finalResult.confidence.purchase_price || 0) < 90 ||
          (finalResult.confidence.buyer_names || 0) < 90;

        // PHASE 5: Save results
        await db.parse.update({
          where: { id: parseId },
          data: {
            status: needsReview ? "NEEDS_REVIEW" : "COMPLETED",
            state: state || "Unknown",
            criticalPageNumbers,
            rawJson: finalResult.raw,
            formatted: finalResult.extracted,
            renderZipUrl: extractZipUrl, // Keep high-res critical pages temporarily
            renderZipKey: extractZipKey,
            finalizedAt: new Date(),
          },
        });

        console.log(`[process:${parseId}] ✓ Complete - confidence: ${finalResult.confidence.overall_confidence}%`);

        // Stream final results
        emit(controller, {
          type: "complete",
          extracted: finalResult.extracted,
          confidence: finalResult.confidence,
          criticalPageNumbers,
          zipUrl: extractZipUrl, // Client will display these images
          needsReview,
        });

        controller.close();
      } catch (error: any) {
        console.error(`[process:${parseId}] Failed:`, error);

        await db.parse.update({
          where: { id: parseId },
          data: {
            status: "EXTRACTION_FAILED",
            errorMessage: error.message,
          },
        }).catch(() => {});

        emit(controller, {
          type: "error",
          message: error.message || "Extraction failed - please try again",
        });

        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
