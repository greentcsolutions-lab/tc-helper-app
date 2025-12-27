// src/app/api/parse/render/[parseId]/route.ts
// Version: 1.0.0 - 2025-12-27
// Renders PDF to dual-DPI images via Nutrient, stores ZIPs in Vercel Blob + DB
// UPDATED: Deduct user credits after successful rendering (before emitting complete)
// SIMPLIFIED: Logging minimized to success states and errors only

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { renderPdfParallel } from "@/lib/pdf/renderer";
import { logSuccess, logError } from "@/lib/debug/parse-logger";

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
        // STEP 1: FETCH PARSE FROM DB
        const parse = await db.parse.findUnique({
          where: { id: parseId },
          select: {
            id: true,
            userId: true,
            pdfBuffer: true,
            status: true,
            fileName: true,
            user: { select: { clerkId: true } },
          },
        });

        if (!parse) {
          logError("RENDER:1", "Parse not found in database");
          emit(controller, { type: "error", message: "Parse not found" });
          controller.close();
          return;
        }

        if (parse.user.clerkId !== clerkUserId) {
          logError("RENDER:1", "Unauthorized access attempt");
          emit(controller, { type: "error", message: "Unauthorized" });
          controller.close();
          return;
        }

        if (parse.status !== "PENDING") {
          logError("RENDER:1", `Invalid status: ${parse.status} (expected PENDING)`);
          emit(controller, { type: "error", message: `Parse status is ${parse.status}` });
          controller.close();
          return;
        }

        if (!parse.pdfBuffer) {
          logError("RENDER:1", "PDF buffer is null");
          emit(controller, { type: "error", message: "PDF buffer not found" });
          controller.close();
          return;
        }

        logSuccess("RENDER:1", `Validated — ${parse.fileName} (${(parse.pdfBuffer.length / 1024).toFixed(2)} KB)`);

        emit(controller, { 
          type: "progress", 
          message: "Starting dual-DPI rendering...",
          phase: "render"
        });

        // STEP 2: RENDER PDF (PARALLEL DUAL-DPI)
        const renderResult = await renderPdfParallel(parse.pdfBuffer);

        logSuccess("RENDER:2", `Rendered ${renderResult.pageCount} pages → ZIPs uploaded`);

        emit(controller, { 
          type: "progress", 
          message: `Rendered ${renderResult.pageCount} pages`,
          phase: "render"
        });

        // STEP 3: SAVE ZIP URLs TO DB (TEMPORARY STORAGE)
        await db.parse.update({
          where: { id: parseId },
          data: {
            lowResZipUrl: renderResult.lowRes.url,
            lowResZipKey: renderResult.lowRes.pathname,
            highResZipUrl: renderResult.highRes.url,
            highResZipKey: renderResult.highRes.pathname,
            pageCount: renderResult.pageCount,
            status: "PROCESSING", // Still processing, not done yet
          },
        });

        logSuccess("RENDER:3", "ZIP URLs saved to database");

        // NEW: Deduct credits after successful render
        const user = await db.user.findUnique({
          where: { clerkId: clerkUserId },
          select: { id: true, credits: true },
        });

        if (!user) {
          throw new Error("User not found for credit deduction");
        }

        if (user.credits <= 0) {
          logError("RENDER:3.5", "Insufficient credits, but allowing pipeline to continue");
          // Note: We allow continuation as per instructions, but log the issue
          // In production, you might want to add notifications or restrictions here
        } else {
          await db.user.update({
            where: { id: user.id },
            data: { credits: { decrement: 1 } },
          });
          logSuccess("RENDER:3.5", "Credit deducted successfully");
        }

        // STEP 4: SEND COMPLETION EVENT
        const completeEvent = {
          type: "complete",
          pageCount: renderResult.pageCount,
          message: "Rendering complete",
        };

        emit(controller, completeEvent);

        controller.close();
      } catch (error: any) {
        console.error(`[ERROR] ${error.message}`);
        console.error(`[ERROR] Stack:`, error.stack);

        // Update DB with error status
        await db.parse.update({
          where: { id: parseId },
          data: {
            status: "RENDER_FAILED",
            errorMessage: error.message || "Rendering failed",
          },
        }).catch((dbError) => {
          console.error(`[ERROR] Failed to update error status:`, dbError);
        });

        emit(controller, {
          type: "error",
          message: error.message || "Rendering failed",
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