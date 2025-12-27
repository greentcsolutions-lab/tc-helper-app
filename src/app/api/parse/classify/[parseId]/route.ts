// src/app/api/parse/classify/[parseId]/route.ts
// Version: 2.1.0 - 2025-12-27
// Classifies critical pages via Grok, stores results in DB (not in-memory cache)

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { downloadAndExtractZip } from "@/lib/pdf/renderer";
import { classifyCriticalPages } from "@/lib/extraction/classify/classifier";
import { logDataShape, logStep, logSuccess, logError } from "@/lib/debug/parse-logger";

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
  console.log(`║ 🔍 CLASSIFY ROUTE STARTED`);
  console.log(`║ ParseID: ${parseId}`);
  console.log(`║ User: ${clerkUserId}`);
  console.log(`${"═".repeat(80)}\n`);

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // STEP 1: FETCH PARSE FROM DB
        logStep("CLASSIFY:1", "🔍 Fetching parse from database...");

        const parse = await db.parse.findUnique({
          where: { id: parseId },
          select: {
            id: true,
            userId: true,
            status: true,
            lowResZipUrl: true,
            highResZipUrl: true,
            pageCount: true,
            user: { select: { clerkId: true } },
          },
        });

        logDataShape("CLASSIFY:1 Database Record", parse);

        if (!parse) {
          logError("CLASSIFY:1", "Parse not found");
          emit(controller, { type: "error", message: "Parse not found" });
          controller.close();
          return;
        }

        if (parse.user.clerkId !== clerkUserId) {
          logError("CLASSIFY:1", "Unauthorized access");
          emit(controller, { type: "error", message: "Unauthorized" });
          controller.close();
          return;
        }

        if (parse.status !== "PROCESSING") {
          logError("CLASSIFY:1", `Invalid status: ${parse.status} (expected PROCESSING)`);
          emit(controller, { type: "error", message: `Invalid status: ${parse.status}` });
          controller.close();
          return;
        }

        if (!parse.lowResZipUrl || !parse.highResZipUrl || !parse.pageCount) {
          logError("CLASSIFY:1", "Missing render artifacts (ZIP URLs or page count)");
          emit(controller, { type: "error", message: "Rendering not complete" });
          controller.close();
          return;
        }

        logSuccess("CLASSIFY:1", `Validated — ${parse.pageCount} pages rendered`);

        emit(controller, {
          type: "progress",
          message: "Downloading rendered images...",
          phase: "classify"
        });

        // STEP 2: DOWNLOAD AND EXTRACT ZIPS
        logStep("CLASSIFY:2", "📥 Downloading and extracting low-DPI ZIP...");

        const lowDpiPages = await downloadAndExtractZip(parse.lowResZipUrl);

        logSuccess("CLASSIFY:2", `Extracted ${lowDpiPages.length} low-DPI pages`);

        emit(controller, {
          type: "progress",
          message: `Extracted ${lowDpiPages.length} pages, starting classification...`,
          phase: "classify"
        });

        // STEP 3: CLASSIFY CRITICAL PAGES
        logStep("CLASSIFY:3", "🧠 Running Grok classification...");

        const {
          criticalImages,
          state,
          criticalPageNumbers,
          packageMetadata,
        } = await classifyCriticalPages(lowDpiPages, parse.pageCount);

        logDataShape("CLASSIFY:3 Classification Results", {
          criticalImagesCount: criticalImages.length,
          state,
          criticalPageNumbers,
          packageMetadata,
        });

        logSuccess("CLASSIFY:3", `Identified ${criticalPageNumbers.length} critical pages`);

        // STEP 4: DOWNLOAD HIGH-DPI PAGES
        logStep("CLASSIFY:4", "📥 Downloading high-DPI ZIP for extraction...");

        const highDpiPages = await downloadAndExtractZip(parse.highResZipUrl);

        logSuccess("CLASSIFY:4", `Extracted ${highDpiPages.length} high-DPI pages`);

        // STEP 5: SAVE TO DATABASE (temporary, deleted after extract)
        logStep("CLASSIFY:5", "💾 Saving classification results to database...");

        const classificationData = {
          criticalImages: criticalImages.map(img => ({
            pageNumber: img.pageNumber,
            base64: img.base64,
            label: img.label,
          })),
          packageMetadata,
          criticalPageNumbers,
          state,
        };

        await db.parse.update({
          where: { id: parseId },
          data: {
            classificationCache: classificationData,
            criticalPageNumbers, // Also store as top-level array for queries
          },
        });

        logSuccess("CLASSIFY:5", "Classification saved to database");

        // STEP 6: SEND COMPLETION EVENT (no base64 in response)
        logStep("CLASSIFY:6", "📤 Sending completion event to client...");

        const completeEvent = {
          type: "complete",
          criticalPageCount: criticalImages.length,
          criticalPageNumbers,
          state,
          detectedForms: packageMetadata.detectedFormCodes,
          message: "Classification complete",
        };

        logDataShape("CLASSIFY:6 Complete Event", completeEvent);
        emit(controller, completeEvent);

        console.log(`\n${"═".repeat(80)}`);
        console.log(`║ ✅ CLASSIFY ROUTE COMPLETED`);
        console.log(`║ ParseID: ${parseId} | Critical Pages: ${criticalPageNumbers.length}`);
        console.log(`║ Results saved to database (no base64 sent to client)`);
        console.log(`${"═".repeat(80)}\n`);

        controller.close();
      } catch (error: any) {
        console.error(`\n${"═".repeat(80)}`);
        console.error(`║ ❌ CLASSIFY ROUTE FAILED`);
        console.error(`║ ParseID: ${parseId}`);
        console.error(`${"═".repeat(80)}`);
        console.error(`\n[ERROR] ${error.message}`);
        console.error(`[ERROR] Stack:`, error.stack);

        // Update DB with error status
        await db.parse.update({
          where: { id: parseId },
          data: {
            status: "CLASSIFICATION_FAILED",
            errorMessage: error.message || "Classification failed",
          },
        }).catch((dbError) => {
          console.error(`[ERROR] Failed to update error status:`, dbError);
        });

        emit(controller, {
          type: "error",
          message: error.message || "Classification failed",
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