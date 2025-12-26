// src/app/api/parse/process/[parseId]/route.ts
// Version: 5.3.0 - 2025-12-24
// REFACTORED: DB mapping + structured logging extracted to helpers
// CORE LOGIC PRESERVED EXACTLY — no changes to rendering, unzip, or argument order

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { renderPdfParallel, downloadAndExtractZip } from "@/lib/pdf/renderer";
import { routeAndExtract } from "@/lib/extraction/router";
import { mapExtractionToParseResult } from "@/lib/parse/map-to-parse-result";
import {
  logDataShape,
  logStep,
  logSuccess,
  logError,
} from "@/lib/debug/parse-logger";

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

  console.log(`\n${"═".repeat(80)}`);
  console.log(`║ 🚀 PROCESS ROUTE STARTED`);
  console.log(`║ ParseID: ${parseId}`);
  console.log(`║ User: ${clerkUserId}`);
  console.log(`${"═".repeat(80)}\n`);

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // STEP 1: DATABASE FETCH
        logStep("STEP 1", "🔍 Fetching parse from database...");

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

        logDataShape("Database Parse Record", parse);

        if (!parse) {
          logError("STEP 1", "Parse not found in database");
          emit(controller, { type: "error", message: "Parse not found" });
          controller.close();
          return;
        }

        if (parse.status !== "PENDING") {
          logError("STEP 1", `Parse status invalid: ${parse.status} (expected PENDING)`);
          emit(controller, { type: "error", message: `Parse status is ${parse.status}, not PENDING` });
          controller.close();
          return;
        }

        if (!parse.pdfBuffer) {
          logError("STEP 1", "PDF buffer is null/undefined");
          emit(controller, { type: "error", message: "PDF buffer not found" });
          controller.close();
          return;
        }

        logSuccess("STEP 1", `Validated — ${parse.fileName} (${(parse.pdfBuffer.length / 1024).toFixed(2)} KB)`);

        // STEP 2: RENDER PDF TO IMAGES (parallel)
        logStep("STEP 2", "🎨 Rendering PDF pages in parallel (Nutrient + Vercel Blob)...");
        const renderResult = await renderPdfParallel(parse.pdfBuffer);

        logSuccess("STEP 2", `Rendered ${renderResult.pageCount} pages → lowRes/highRes ZIPs uploaded`);

        // STEP 3: DOWNLOAD AND EXTRACT ZIPs → in-memory base64 pages
        logStep("STEP 3", "📥 Downloading and extracting low-DPI + high-DPI ZIPs...");

        const lowDpiPages = await downloadAndExtractZip(renderResult.lowRes.url);
        const highDpiPages = await downloadAndExtractZip(renderResult.highRes.url);

        logSuccess("STEP 3", `Extracted ${lowDpiPages.length} low-DPI and ${highDpiPages.length} high-DPI pages`);

        // STEP 4: CLASSIFY + ROUTE + EXTRACT
        logStep("STEP 4", "🧠 Running classification + routing + universal extraction...");

        const {
          universal,
          route,
          details,
          timelineEvents,
          needsReview,
          metadata,
        } = await routeAndExtract(
          lowDpiPages,
          highDpiPages,
          renderResult.pageCount
        );

        logDataShape("Extraction Result Summary", {
          route,
          needsReview,
          criticalPages: metadata.criticalPageNumbers.length,
        });

        logSuccess("STEP 4", `Extraction complete — Route: ${route}${needsReview ? " (needs review)" : ""}`);

        const finalStatus = needsReview ? "NEEDS_REVIEW" : "COMPLETED";

        // STEP 5: MAP TO DB FIELDS
        logStep("STEP 5", "🗺️ Mapping extraction to enriched ParseResult fields");

        const mappedFields = mapExtractionToParseResult({
          universal,
          route,
          details: details || undefined,
          timelineEvents,
        });

        logDataShape("Mapped DB Fields", mappedFields);

        // STEP 6: SAVE TO DATABASE
        logStep("STEP 6", "💾 Saving results to database...");

        const dbUpdateData = {
          status: finalStatus,
          ...mappedFields,
          rawJson: {
            _extraction_route: route,
            _classifier_metadata: metadata.packageMetadata,
            _critical_pages: metadata.criticalPageNumbers,
            _critical_page_count: metadata.criticalPageNumbers.length,
          },
          finalizedAt: new Date(),
        };

        logDataShape("Final DB Update Data", dbUpdateData);

        const finalParse = await db.parse.update({
          where: { id: parseId },
          data: dbUpdateData,
        });

        logSuccess("STEP 6", `Saved — Status: ${finalParse.status}`);

        // STEP 7: SEND COMPLETION EVENT
        logStep("STEP 7", "📤 Sending completion event to client...");

        const completeEvent = {
          type: "complete",
          extracted: universal,
          zipUrl: renderResult.lowRes.url,
          needsReview,
          route,
          pageCount: renderResult.pageCount,
          criticalPageNumbers: metadata.criticalPageNumbers,
        };

        logDataShape("SSE Complete Event", completeEvent);
        emit(controller, completeEvent);

        logSuccess("STEP 7", "Complete event sent");

        console.log(`\n${"═".repeat(80)}`);
        console.log(`║ ✅ PROCESS ROUTE COMPLETED SUCCESSFULLY`);
        console.log(`║ ParseID: ${parseId} | Route: ${route} | Status: ${finalStatus}`);
        console.log(`${"═".repeat(80)}\n`);

        controller.close();
      } catch (error: any) {
        console.error(`\n${"═".repeat(80)}`);
        console.error(`║ ❌ PROCESS ROUTE FAILED`);
        console.error(`║ ParseID: ${parseId}`);
        console.error(`${"═".repeat(80)}`);
        console.error(`\n[ERROR] ${error.message}`);
        console.error(`[ERROR] Stack trace:`, error.stack);

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
        }).catch((dbError) => {
          console.error(`[ERROR] Failed to update error status in DB:`, dbError);
        });

        emit(controller, {
          type: "error",
          message: errorMessage,
        });

        console.error(`${"═".repeat(80)}\n`);
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