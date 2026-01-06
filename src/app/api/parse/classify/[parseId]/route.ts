// src/app/api/parse/classify/[parseId]/route.ts
// Version: 2.0.0 - 2025-12-30
// BREAKING CHANGE: Uses single 200 DPI ZIP (renderZipUrl) instead of lowResZipUrl
// UPDATED: Reads from renderZipUrl field in database

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { downloadAndExtractZip } from "@/lib/pdf/renderer";
import { classifyCriticalPages } from "@/lib/extraction/classify/classifier";
import { logSuccess, logError, logStep } from "@/lib/debug/parse-logger";

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
      try {
        // STEP 1: VALIDATE PARSE
        logStep("CLASSIFY:1", "Validating parse and render completion...");

        const parse = await db.parse.findUnique({
          where: { id: parseId },
          select: {
            id: true,
            userId: true,
            status: true,
            renderZipUrl: true,  // CHANGED: Now using universal renderZipUrl
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
          logError("CLASSIFY:1", "Unauthorized");
          emit(controller, { type: "error", message: "Unauthorized" });
          controller.close();
          return;
        }

        if (parse.status !== "PROCESSING") {
          logError("CLASSIFY:1", `Invalid status: ${parse.status}`);
          emit(controller, { type: "error", message: `Invalid status: ${parse.status}` });
          controller.close();
          return;
        }

        if (!parse.renderZipUrl) {  // CHANGED: Check renderZipUrl instead of lowResZipUrl
          logError("CLASSIFY:1", "Rendering not complete");
          emit(controller, { type: "error", message: "Rendering not complete" });
          controller.close();
          return;
        }

        logSuccess("CLASSIFY:1", `Validated — ${parse.pageCount} pages`);

        emit(controller, {
          type: "progress",
          message: "Downloading rendered images...",
          phase: "classify"
        });

        // STEP 2: DOWNLOAD AND EXTRACT ZIP
        logStep("CLASSIFY:2", "📥 Downloading and extracting 200 DPI ZIP...");

        const pages = await downloadAndExtractZip(parse.renderZipUrl);  // CHANGED: Use universal ZIP

        logSuccess("CLASSIFY:2", `Extracted ${pages.length} pages`);

        emit(controller, {
          type: "progress",
          message: `Extracted ${pages.length} pages, starting classification...`,
          phase: "classify"
        });

        // STEP 3: CLASSIFY CRITICAL PAGES
        logStep("CLASSIFY:3", "Finding the important pages...");

        const {
          criticalImages,
          state,
          criticalPageNumbers,
          packageMetadata,
        } = await classifyCriticalPages(pages, parse.pageCount!);

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

        console.log(`[classify] 🔍 DEBUG: Saved to DB:`);
        console.log(`[classify] 🔍 criticalPageNumbers: [${criticalPageNumbers.join(', ')}]`);
        console.log(`[classify] 🔍 criticalImages.length: ${criticalImages.length}`);
        console.log(`[classify] 🔍 criticalImages page numbers: [${criticalImages.map(i => i.pageNumber).join(', ')}]`);

        const metadataSize = JSON.stringify(classificationMetadata).length;
        logSuccess("CLASSIFY:4", `Metadata saved (${(metadataSize / 1024).toFixed(1)} KB - no base64!)`);

        // STEP 5: COMPLETE
        emit(controller, {
          type: "complete",
          criticalPageCount: criticalPageNumbers.length,
          detectedForms: packageMetadata.detectedFormCodes,
          state,
        });

        logSuccess("CLASSIFY:DONE", `Classification complete — ${criticalPageNumbers.length} critical pages`);

        controller.close();
      } catch (error: any) {
        logError("CLASSIFY:ERROR", error.message);
        console.error("[Classify Route] Full error:", error);

        emit(controller, {
          type: "error",
          message: error.message || "Classification failed"
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