// src/app/api/parse/preview/[parseId]/route.ts
// FINAL — Fixed Clerk → CUID foreign key issue

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { renderPdfToPngBase64Array } from "@/lib/extractor/pdfrest";
import { classifyCriticalPages } from "@/lib/extractor/classifier";

export const runtime = "nodejs";
export const maxDuration = 60;

function streamJsonLine(data: any) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { parseId: string } }
) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return new Response("Unauthorized", { status: 401 });

  // ← CRITICAL FIX: Convert Clerk ID → internal CUID
  const user = await db.user.findUnique({
    where: { clerkId: clerkUserId },
    select: { id: true },
  });

  if (!user) {
    return new Response("User not found", { status: 404 });
  }

  const { parseId } = params;

  const parseRecord = await db.parse.findUnique({
    where: { 
      id: parseId,
      userId: user.id  // ← Now using correct CUID, not Clerk ID
    },
    select: { pdfBuffer: true, status: true, fileName: true },
  });

  if (!parseRecord) {
    return new Response("Parse not found or access denied", { status: 404 });
  }

  if (parseRecord.status !== "AWAITING_CONFIRMATION") {
    return new Response("Document already processed", { status: 400 });
  }

  if (!parseRecord.pdfBuffer) {
    return new Response("PDF buffer missing", { status: 500 });
  }

  const readable = new ReadableStream({
    async start(controller) {
      try {
        // PHASE 1: Stream first 9 pages for confirmation
        controller.enqueue(streamJsonLine({ type: "progress", message: "Loading preview..." }));

        const first9 = await renderPdfToPngBase64Array(parseRecord.pdfBuffer!, { maxPages: 9 });

        for (const page of first9) {
          controller.enqueue(streamJsonLine({
            type: "page",
            pageNumber: page.pageNumber,
            base64: page.base64,
            phase: "confirm",
          }));
        }

        controller.enqueue(streamJsonLine({ type: "confirm_ready" }));
        controller.enqueue(streamJsonLine({ type: "progress", message: "Ready — click Continue to extract" }));

        // PHASE 2: Run classifier + show critical pages
        controller.enqueue(streamJsonLine({ type: "progress", message: "Analyzing full document..." }));

        const allPages = await renderPdfToPngBase64Array(parseRecord.pdfBuffer!);
        const { criticalImages, state, criticalPageNumbers } = await classifyCriticalPages(allPages);

        await db.parse.update({
          where: { id: parseId },
          data: {
            state: state || "Unknown",
            criticalPageNumbers,
            status: "READY_FOR_EXTRACT",
          },
        });

        controller.enqueue(streamJsonLine({
          type: "critical_start",
          count: criticalImages.length,
          state,
        }));

        for (const page of criticalImages) {
          controller.enqueue(streamJsonLine({
            type: "critical_page",
            pageNumber: page.pageNumber,
            base64: page.base64,
          }));
        }

        // AUTO-TRIGGER FINAL EXTRACTION
        controller.enqueue(streamJsonLine({ type: "progress", message: "Extracting price, names, dates..." }));

        const baseUrl = process.env.NEXT_PUBLIC_URL || "http://localhost:3000";
        fetch(`${baseUrl}/api/parse/extract/${parseId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }).catch(err => {
          console.error("[preview] Failed to trigger extract:", err);
        });

        controller.enqueue(streamJsonLine({ type: "extraction_started" }));
        controller.enqueue(streamJsonLine({ type: "done" }));
        controller.close();
      } catch (error: any) {
        console.error("[preview] Stream error:", error);
        controller.enqueue(streamJsonLine({ 
          type: "error", 
          message: error.message || "Processing failed" 
        }));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    },
  });
}