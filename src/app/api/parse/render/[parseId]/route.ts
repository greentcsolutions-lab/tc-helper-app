// src/app/api/parse/render/[parseId]/route.ts
// Version: 1.0.0 - 2025-12-27
// Renders PDF to dual-DPI images via Nutrient, stores ZIPs in Vercel Blob + DB

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { renderPdfParallel } from "@/lib/pdf/renderer";
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
  console.log(`║ 🎨 RENDER ROUTE STARTED`);
  console.log(`║ ParseID: ${parseId}`);
  console.log(`║ User: ${clerkUserId}`);
  console.log(`${"═".repeat(80)}\n`);

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // STEP 1: FETCH PARSE FROM DB
        logStep("RENDER:1", "🔍 Fetching parse from database...");

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

        logDataShape("RENDER:1 Database Record", parse);

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
        logStep("RENDER:2", "🎨 Rendering PDF pages in parallel (Nutrient + Vercel Blob)...");

        const renderResult = await renderPdfParallel(parse.pdfBuffer);

        logSuccess("RENDER:2", `Rendered ${renderResult.pageCount} pages → ZIPs uploaded`);

        emit(controller, { 
          type: "progress", 
          message: `Rendered ${renderResult.pageCount} pages`,
          phase: "render"
        });

        // STEP 3: SAVE ZIP URLs TO DB (TEMPORARY STORAGE)
        logStep("RENDER:3", "💾 Saving ZIP URLs to database (temporary)...");

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

        // STEP 4: SEND COMPLETION EVENT
        logStep("RENDER:4", "📤 Sending completion event...");

        const completeEvent = {
          type: "complete",
          pageCount: renderResult.pageCount,
          message: "Rendering complete",
        };

        logDataShape("RENDER:4 Complete Event", completeEvent);
        emit(controller, completeEvent);

        console.log(`\n${"═".repeat(80)}`);
        console.log(`║ ✅ RENDER ROUTE COMPLETED`);
        console.log(`║ ParseID: ${parseId} | Pages: ${renderResult.pageCount}`);
        console.log(`${"═".repeat(80)}\n`);

        controller.close();
      } catch (error: any) {
        console.error(`\n${"═".repeat(80)}`);
        console.error(`║ ❌ RENDER ROUTE FAILED`);
        console.error(`║ ParseID: ${parseId}`);
        console.error(`${"═".repeat(80)}`);
        console.error(`\n[ERROR] ${error.message}`);
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