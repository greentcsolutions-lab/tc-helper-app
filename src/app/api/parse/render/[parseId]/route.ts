// src/app/api/parse/render/[parseId]/route.ts
// Version: 2.0.0 - 2025-12-30
// BREAKING CHANGE: Single 200 DPI render for both classification and extraction
// REMOVED: Dual parallel rendering (lowRes/highRes split)
// SIMPLIFIED: One ZIP URL stored in database

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { renderPdfSingle } from "@/lib/pdf/renderer";
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
        // STEP 1: FETCH PARSE FROM DB
        logStep("RENDER:1", "Validating parse record...");

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
          message: "Starting 200 DPI rendering...",
          phase: "render"
        });

        // STEP 2: RENDER PDF (SINGLE 200 DPI)
        logStep("RENDER:2", "Rendering PDF at 200 DPI...");

        const renderResult = await renderPdfSingle(parse.pdfBuffer);

        logSuccess("RENDER:2", `Rendered ${renderResult.pageCount} pages → ZIP uploaded`);

        emit(controller, { 
          type: "progress", 
          message: `Rendered ${renderResult.pageCount} pages`,
          phase: "render"
        });

        // STEP 3: SAVE ZIP URL TO DB (SINGLE STORAGE)
        logStep("RENDER:3", "Saving render metadata to database...");

        await db.parse.update({
          where: { id: parseId },
          data: {
            // NEW: Single universal ZIP for both classification and extraction
            renderZipUrl: renderResult.url,
            renderZipKey: renderResult.pathname,
            
            // DEPRECATED: Keep these NULL for backward compatibility
            lowResZipUrl: null,
            lowResZipKey: null,
            highResZipUrl: null,
            highResZipKey: null,
            
            pageCount: renderResult.pageCount,
            status: "PROCESSING", // Still processing, not done yet
          },
        });

        logSuccess("RENDER:3", "ZIP URL saved to database");

        // STEP 4: DEDUCT USER CREDITS
        logStep("RENDER:4", "Deducting user credits...");

        const user = await db.user.findUnique({
          where: { clerkId: clerkUserId },
          select: { credits: true },
        });

        if (!user) {
          logError("RENDER:4", "User not found");
          emit(controller, { type: "error", message: "User not found" });
          controller.close();
          return;
        }

        if (user.credits < 1) {
          logError("RENDER:4", "Insufficient credits");
          emit(controller, { type: "error", message: "Insufficient credits" });
          controller.close();
          return;
        }

        await db.user.update({
          where: { clerkId: clerkUserId },
          data: { credits: { decrement: 1 } },
        });

        logSuccess("RENDER:4", `Credits deducted (remaining: ${user.credits - 1})`);

        // STEP 5: COMPLETE
        emit(controller, { 
          type: "complete", 
          pageCount: renderResult.pageCount 
        });

        logSuccess("RENDER:DONE", `Render pipeline complete — ${renderResult.pageCount} pages ready`);
        
        controller.close();
      } catch (error: any) {
        logError("RENDER:ERROR", error.message);
        console.error("[Render Route] Full error:", error);

        emit(controller, { 
          type: "error", 
          message: error.message || "Rendering failed" 
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