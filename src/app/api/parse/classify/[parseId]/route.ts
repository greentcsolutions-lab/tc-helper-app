// src/app/api/parse/classify/[parseId]/route.ts
// Version: 3.0.0 - 2025-12-30
// BREAKING: Deletes low-res ZIP immediately after classification completes (Step 4.5)
// This ensures only ONE set of working images exists at a time

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { del } from "@vercel/blob";
import { downloadAndExtractZip } from "@/lib/pdf/renderer";
import { classifyCriticalPages } from "@/lib/extraction/classify/classifier";
import { logStep, logSuccess, logError } from "@/lib/debug/parse-logger";

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

  const stream = new ReadableStream({
    async start(controller) {
      // Store lowResZipKey in function scope so cleanup can access it
      let lowResZipKeyToDelete: string | null = null;

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
            lowResZipKey: true,  // ← Need this for deletion
            pageCount: true,
            user: { select: { clerkId: true } },
          },
        });

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

        if (!parse.lowResZipUrl || !parse.pageCount) {
          logError("CLASSIFY:1", "Missing render artifacts (ZIP URLs or page count)");
          emit(controller, { type: "error", message: "Rendering not complete" });
          controller.close();
          return;
        }

        // Store for cleanup
        lowResZipKeyToDelete = parse.lowResZipKey;

        logSuccess("CLASSIFY:1", `Validated — ${parse.pageCount} pages rendered`);

        emit(controller, {
          type: "progress",
          message: "Downloading rendered images...",
          phase: "classify"
        });

        // STEP 2: DOWNLOAD AND EXTRACT LOW-RES ZIP
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

        logSuccess("CLASSIFY:3", `Identified ${criticalPageNumbers.length} critical pages`);

        // STEP 4: SAVE METADATA ONLY (NO BASE64!)
        logStep("CLASSIFY:4", "💾 Saving classification metadata to database...");

        // Build page labels map (no base64)
        const pageLabels: Record<number, string> = {};
        criticalImages.forEach(img => {
          pageLabels[img.pageNumber] = img.label;
        });

        const classificationMetadata = {
          criticalPageNumbers,
          pageLabels,
          packageMetadata,
          state,
        };

        await db.parse.update({
          where: { id: parseId },
          data: {
            classificationCache: classificationMetadata,
            criticalPageNumbers,
          },
        });

        const metadataSize = JSON.stringify(classificationMetadata).length;
        logSuccess("CLASSIFY:4", `Metadata saved (${(metadataSize / 1024).toFixed(1)} KB - no base64!)`);

        // ═══════════════════════════════════════════════════════════════════
        // STEP 4.5: DELETE LOW-RES ZIP IMMEDIATELY (CRITICAL!)
        // ═══════════════════════════════════════════════════════════════════
        // This ensures we only have ONE set of working images at a time
        // After this point, only high-res ZIP remains for extraction
        logStep("CLASSIFY:4.5", "🗑️ Deleting low-res ZIP from Blob storage...");

        if (lowResZipKeyToDelete) {
          try {
            await del(lowResZipKeyToDelete);
            logSuccess("CLASSIFY:4.5", "Low-res ZIP deleted from Blob storage");
          } catch (err) {
            console.warn(`[classify:${parseId}] ⚠️ Low-res ZIP deletion failed:`, err);
            // Don't fail the whole pipeline - extraction can still proceed
          }
        }

        // Clear low-res ZIP URLs from database
        await db.parse.update({
          where: { id: parseId },
          data: {
            lowResZipUrl: null,
            lowResZipKey: null,
          },
        });

        logSuccess("CLASSIFY:4.5", "Low-res ZIP URLs cleared from database");

        console.log(`\n${"═".repeat(80)}`);
        console.log(`║ ✅ LOW-RES CLEANUP COMPLETE`);
        console.log(`║ ParseID: ${parseId}`);
        console.log(`║ Remaining: Metadata (${(metadataSize / 1024).toFixed(1)} KB) + high-res ZIP only`);
        console.log(`${"═".repeat(80)}\n`);

        // STEP 5: SEND COMPLETION EVENT
        logStep("CLASSIFY:5", "📤 Sending completion event to client...");

        const completeEvent = {
          type: "complete",
          criticalPageCount: criticalImages.length,
          criticalPageNumbers,
          state,
          detectedForms: packageMetadata.detectedFormCodes,
          message: "Classification complete",
        };

        emit(controller, completeEvent);

        controller.close();
      } catch (error: any) {
        console.error(`[ERROR] ${error.message}`);
        console.error(`[ERROR] Stack:`, error.stack);

        // Attempt to delete low-res ZIP even on failure (cleanup)
        if (lowResZipKeyToDelete) {
          try {
            await del(lowResZipKeyToDelete);
            console.log(`[classify:${parseId}] ✓ Cleaned up low-res ZIP despite error`);
          } catch (cleanupErr) {
            console.warn(`[classify:${parseId}] ⚠️ Cleanup failed:`, cleanupErr);
          }
        }

        await db.parse.update({
          where: { id: parseId },
          data: {
            status: "CLASSIFICATION_FAILED",
            errorMessage: error.message || "Classification failed",
            lowResZipUrl: null,
            lowResZipKey: null,
          },
        }).catch((dbError) => {
          console.error(`[ERROR] Failed to update error status:`, dbError);
        });

        emit(controller, {
          type: "error",
          message: error.message || "Classification failed",
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