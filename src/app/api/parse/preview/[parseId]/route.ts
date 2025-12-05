// src/app/api/parse/preview/[parseId]/route.ts
// FULLY FIXED — No TS errors, safe, production ready

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
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const { parseId } = params;

  const parseRecord = await db.parse.findUnique({
    where: { id: parseId, userId },
    select: { pdfBuffer: true, status: true, fileName: true },
  });

  if (!parseRecord || parseRecord.status !== "AWAITING_CONFIRMATION") {
    return new Response("Invalid parse state", { status: 400 });
  }

  // FIX 1 & 2: Null guard
  if (!parseRecord.pdfBuffer) {
    return new Response("PDF buffer missing", { status: 500 });
  }

  const readable = new ReadableStream({
    async start(controller) {
      try {
        // PHASE 1: First 9 pages
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

        // PHASE 2: Auto-trigger classification + extraction
        controller.enqueue(streamJsonLine({ type: "progress", message: "Analyzing document..." }));

        const allPages = await renderPdfToPngBase64Array(parseRecord.pdfBuffer!);
        const { criticalImages, state, criticalPageNumbers } = await classifyCriticalPages(allPages);

        // FIX 3: Remove pageCount from update
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

        // AUTO-TRIGGER EXTRACT
        controller.enqueue(streamJsonLine({ type: "progress", message: "Extracting data..." }));

        fetch(`${process.env.NEXT_PUBLIC_URL || ""}/api/parse/extract/${parseId}`, {
          method: "POST",
        }).catch(err => console.error("[preview] Extract trigger failed:", err));

        controller.enqueue(streamJsonLine({ type: "extraction_started" }));
        controller.enqueue(streamJsonLine({ type: "done" }));
        controller.close();
      } catch (error: any) {
        console.error("[preview] Error:", error);
        controller.enqueue(streamJsonLine({ type: "error", message: error.message || "Processing failed" }));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}