// src/app/api/parse/classify/[parseId]/route.ts
// Version: 3.2.1 - 2025-12-30
// OPTIMIZED: Minimal logging under 256 line limit

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { downloadAndExtractZip } from "@/lib/pdf/renderer";
import { classifyCriticalPages } from "@/lib/extraction/classify/classifier";
import { logStep, logSuccess, logError } from "@/lib/debug/parse-logger";

export const runtime = "nodejs";
export const maxDuration = 300;

function emit(controller: ReadableStreamDefaultController, data: any) {
  controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ parseId: string }> }
) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return new Response("Unauthorized", { status: 401 });

  const { parseId } = await params;

  console.log(`[classify] START parseId=${parseId}`);

  const stream = new ReadableStream({
    async start(controller) {
      try {
        logStep("CLASSIFY:1", "Validating parse...");

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

        if (!parse.lowResZipUrl || !parse.highResZipUrl) {
          logError("CLASSIFY:1", "Rendering not complete");
          emit(controller, { type: "error", message: "Rendering not complete" });
          controller.close();
          return;
        }

        logSuccess("CLASSIFY:1", `Validated — ${parse.pageCount} pages`);
        emit(controller, { type: "progress", message: "Downloading images...", phase: "classify" });

        logStep("CLASSIFY:2", "Downloading low-DPI ZIP...");
        const lowDpiPages = await downloadAndExtractZip(parse.lowResZipUrl);
        logSuccess("CLASSIFY:2", `Extracted ${lowDpiPages.length} pages`);

        emit(controller, {
          type: "progress",
          message: `Extracted ${lowDpiPages.length} pages, classifying...`,
          phase: "classify"
        });

        logStep("CLASSIFY:3", "Running classification...");
        const { criticalImages, state, criticalPageNumbers, packageMetadata } = 
          await classifyCriticalPages(lowDpiPages, parse.pageCount || lowDpiPages.length);
        logSuccess("CLASSIFY:3", `Identified ${criticalPageNumbers.length} critical pages`);

        logStep("CLASSIFY:4", "Saving metadata...");

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

        console.log(`[classify] STORED: ${criticalPageNumbers.length} pages [${criticalPageNumbers.join(',')}] forms=[${packageMetadata.detectedFormCodes.join(',')}]`);
        logSuccess("CLASSIFY:4", `Saved ${(JSON.stringify(classificationMetadata).length / 1024).toFixed(1)}KB metadata`);

        logStep("CLASSIFY:5", "Sending completion...");
        emit(controller, {
          type: "complete",
          criticalPageCount: criticalImages.length,
          criticalPageNumbers,
          state,
          detectedForms: packageMetadata.detectedFormCodes,
          message: "Classification complete",
        });

        controller.close();
      } catch (error: any) {
        console.error(`[classify] ERROR: ${error.message}`);
        await db.parse.update({
          where: { id: parseId },
          data: {
            status: "CLASSIFICATION_FAILED",
            errorMessage: error.message || "Classification failed",
          },
        }).catch((dbError) => {
          console.error(`[classify] DB update failed:`, dbError);
        });

        emit(controller, { type: "error", message: error.message || "Classification failed" });
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