// src/app/api/parse/process/[parseId]/route.ts
// Version: 5.1.0 - 2025-12-23
// Fixed: No longer assumes .pages on renderResult
// Uses downloadAndExtractZip for low-res classification pages

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
        //@ts-ignore
        console.log(`[process:${parseId}] Buffer size: ${(parse.pdfBuffer.length / 1024).toFixed(2)} KB`);
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
        console.log(`[process:${parseId}] Low-res ZIP: ${renderResult.lowRes.key}`);
        console.log(`[process:${parseId}] High-res ZIP: ${renderResult.highRes.key}`);

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
            lowResZipKey: renderResult.lowRes.key,
            highResZipUrl: renderResult.highRes.url,
            highResZipKey: renderResult.highRes.key,
            pdfBuffer: null, // Clear original buffer
          },
        });

        emit(controller, {
          type: "progress",
          message: `Downloading low-res images for AI analysis...`,
          stage: "download_lowres",
        });

        // Phase 2: Download + extract low-res ZIP for classification
        // This gives us { pageNumber: number; base64: string }[]
        const lowResPages = await downloadAndExtractZip(renderResult.lowRes.url);

        console.log(`[process:${parseId}] ✓ Low-res pages extracted: ${lowResPages.length}`);

        emit(controller, {
          type: "progress",
          message: `Analyzing document with AI...`,
          stage: "extraction_ai",
        });

        // Phase 3: Run full extraction pipeline (classifier → router → universal)
        // Note: We pass empty highResPages array for now — universal uses low-res for extraction
        // Later, when we build selective high-res extraction, we'll download high-res ZIP selectively
        const extractionResult = await routeAndExtract(
          lowResPages,
          lowResPages, // fallback: use low-res for extraction (still good enough for Grok)
          pageCount
        );

        const { universal, details, timelineEvents, needsReview, route, metadata } = extractionResult;

        const finalStatus = needsReview ? "NEEDS_REVIEW" : "COMPLETED";

        console.log(`[process:${parseId}] Extraction route: ${route}`);
        console.log(`[process:${parseId}] Needs review: ${needsReview}`);
        console.log(`[process:${parseId}] Final status: ${finalStatus}`);

        // Save results to DB
        await db.parse.update({
          where: { id: parseId },
          data: {
            status: finalStatus,
            // === Universal core fields (add these to your Prisma model first!) ===
            buyerNames: universal.buyerNames,
            sellerNames: universal.sellerNames,
            propertyAddress: universal.propertyAddress || null,
            purchasePrice: universal.purchasePrice || null,
            earnestMoneyAmount: universal.earnestMoneyDeposit.amount,
            earnestMoneyHolder: universal.earnestMoneyDeposit.holder,
            closingDate: universal.closingDate
              ? typeof universal.closingDate === "string"
                ? universal.closingDate
                : null // handle "X days" later when needed
              : null,
            effectiveDate: universal.effectiveDate,
            isAllCash: universal.financing.isAllCash,
            loanType: universal.financing.loanType,
            // === Rich data ===
            extractionDetails: details ? { route, ...details } : { route },
            timelineEvents: timelineEvents.length > 0 ? timelineEvents : null,
            // === Debug/metadata ===
            rawJson: {
              _extraction_route: route,
              _classifier_metadata: metadata.packageMetadata,
              _critical_pages: metadata.criticalPageNumbers,
            },
            finalizedAt: new Date(),
          },
        });

        console.log(`[process:${parseId}] ✅ Extraction complete & saved to DB`);

        emit(controller, {
          type: "complete",
          extracted: universal,
          needsReview,
          route,
          pageCount,
          criticalPages: metadata.criticalPageNumbers.length,
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