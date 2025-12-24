// src/app/api/parse/process/[parseId]/route.ts
// Version: 5.1.2 - 2025-12-23
// Fixed: Added zipUrl to SSE complete event (was missing, causing client crash)

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { renderPdfParallel, downloadAndExtractZip } from "@/lib/pdf/renderer";
import { routeAndExtract } from "@/lib/extraction/router";

export const runtime = "nodejs";
export const maxDuration = 300;

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
        console.log(`\n${"=".repeat(80)}`);
        console.log(`[process:${parseId}] 🚀 EXTRACTION PIPELINE STARTED`);
        console.log(`[process:${parseId}] File: ${parse.fileName}`);
        
        if (!parse.pdfBuffer) {
          return Response.json({ error: "PDF not found" }, { status: 500 });
        }

        const bufferSize = Buffer.isBuffer(parse.pdfBuffer) 
           ? (parse.pdfBuffer.length / 1024).toFixed(2) 
           : 'unknown';
        console.log(`[process:${parseId}] Buffer size: ${bufferSize} KB`);
        console.log(`${"=".repeat(80)}\n`);

        emit(controller, {
          type: "progress",
          message: "Rendering document in parallel (150 + 300 DPI)...",
          stage: "render_parallel",
        });

        // Phase 1: Parallel dual-DPI render + upload
        const renderResult = await renderPdfParallel(
          //@ts-ignore
          parse.pdfBuffer
        );

        const pageCount = renderResult.pageCount;

        console.log(`[process:${parseId}] ✓ Render complete: ${pageCount} pages`);
        console.log(`[process:${parseId}] Low-res ZIP: ${renderResult.lowRes.pathname}`);
        console.log(`[process:${parseId}] High-res ZIP: ${renderResult.highRes.pathname}`);

        // Deduct credit
        await db.user.update({
          where: { id: parse.userId },
          data: { credits: { decrement: 1 } },
        });

        // Store render artifacts
        await db.parse.update({
          where: { id: parseId },
          data: {
            status: "RENDERED",
            pageCount,
            lowResZipUrl: renderResult.lowRes.url,
            lowResZipKey: renderResult.lowRes.pathname,
            highResZipUrl: renderResult.highRes.url,
            highResZipKey: renderResult.highRes.pathname,
            pdfBuffer: null, // Clear original buffer
          },
        });

        emit(controller, {
          type: "progress",
          message: `Downloading low-res images for AI analysis...`,
          stage: "download_lowres",
        });

        // Phase 2: Download + extract low-res ZIP for classification
        const lowResPages = await downloadAndExtractZip(renderResult.lowRes.url);

        console.log(`[process:${parseId}] ✓ Low-res pages extracted: ${lowResPages.length}`);

        emit(controller, {
          type: "progress",
          message: `Analyzing document with AI...`,
          stage: "extraction_ai",
        });

        // Phase 3: Run full extraction pipeline (classifier → router → universal)
        const extractionResult = await routeAndExtract(
          lowResPages,
          lowResPages, // fallback: use low-res for extraction
          pageCount
        );

        const { universal, details, timelineEvents, needsReview, route, metadata } = extractionResult;

        const finalStatus = needsReview ? "NEEDS_REVIEW" : "COMPLETED";

        console.log(`[process:${parseId}] Extraction route: ${route}`);
        console.log(`[process:${parseId}] Needs review: ${needsReview}`);
        console.log(`[process:${parseId}] Final status: ${finalStatus}`);

        // === Save results to DB ===
        await db.parse.update({
  where: { id: parseId },
  data: {
    status: finalStatus,
    // === UNIVERSAL CORE FIELDS (safe optional chaining) ===
    buyerNames: universal.buyerNames ?? [],
    sellerNames: universal.sellerNames ?? [],
    propertyAddress: universal.propertyAddress ?? null,
    purchasePrice: universal.purchasePrice ?? null,
    earnestMoneyAmount: universal.earnestMoneyDeposit?.amount ?? null,
    earnestMoneyHolder: universal.earnestMoneyDeposit?.holder ?? null,
    closingDate: 
  universal.closingDate == null 
    ? null 
    : typeof universal.closingDate === 'string' 
      ? universal.closingDate 
      : null, // drop numbers — we only store YYYY-MM-DD string format

effectiveDate: 
  universal.effectiveDate == null 
    ? null 
    : typeof universal.effectiveDate === 'string' 
      ? universal.effectiveDate 
      : null, // same — only accept strings
    isAllCash: universal.financing?.isAllCash ?? null,
    loanType: universal.financing?.loanType ?? null,

    // === RICH DATA (preserve as-is) ===
    extractionDetails: details ? { route, ...details } : { route },
    ...(timelineEvents.length > 0 ? { timelineEvents } : {}),

    // === DEBUG / METADATA ===
    rawJson: {
      _extraction_route: route,
      _classifier_metadata: metadata.packageMetadata,
      _critical_pages: metadata.criticalPageNumbers,
      _critical_page_count: metadata.criticalPageNumbers.length,
    },
    finalizedAt: new Date(),
  },
});
        console.log(`[process:${parseId}] ✅ Extraction complete & saved to DB`);

        // FIXED: Added zipUrl to complete event
        emit(controller, {
          type: "complete",
          extracted: universal,
          zipUrl: renderResult.lowRes.url, // ← ADDED THIS LINE
          needsReview,
          route,
          pageCount,
          criticalPageNumbers: metadata.criticalPageNumbers, // ← Also renamed from criticalPages
        });

        controller.close();

      } catch (error: any) {
        console.error(`[process:${parseId}] ❌ EXTRACTION FAILED:`, error);

        let errorMessage = error.message || "Extraction failed";
        if (error.message?.includes("exceeds 100-page limit")) {
          errorMessage = "Document too large (max 100 pages)";
        }

        await db.parse.update({
          where: { id: parseId },
          data: {
            status: "EXTRACTION_FAILED",
            errorMessage,
          },
        }).catch(() => {});

        emit(controller, {
          type: "error",
          message: errorMessage,
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