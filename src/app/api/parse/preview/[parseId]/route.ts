// src/app/api/parse/preview/[parseId]/route.ts
// FINAL — Real-time professional status updates during full analysis

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { renderPdfToPngBase64Array } from "@/lib/extractor/pdfrest";
import { classifyCriticalPages } from "@/lib/extractor/classifier";
import { uploadProgress } from "@/lib/progress";

export const runtime = "nodejs";
export const maxDuration = 60;

function streamJsonLine(data: any) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

function logProgress(parseId: string, message: string) {
  const existing = uploadProgress.get(parseId) || [];
  existing.push({ message, timestamp: Date.now() });
  uploadProgress.set(parseId, existing);
}

export async function GET(
  request: NextRequest,
  { params }: { params: { parseId: string } }
) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return new Response("Unauthorized", { status: 401 });

  const user = await db.user.findUnique({
    where: { clerkId: clerkUserId },
    select: { id: true },
  });

  if (!user) return new Response("User not found", { status: 404 });

  const { parseId } = params;

  const parseRecord = await db.parse.findUnique({
    where: { id: parseId, userId: user.id },
    select: { pdfBuffer: true, status: true, fileName: true },
  });

  if (!parseRecord || parseRecord.status !== "AWAITING_CONFIRMATION" || !parseRecord.pdfBuffer) {
    return new Response("Invalid or already processed document", { status: 400 });
  }

  const readable = new ReadableStream({
    async start(controller) {
      try {
        logProgress(parseId, "Analyzing full document to identify key pages...");
        controller.enqueue(streamJsonLine({ type: "progress", message: "Analyzing full document to identify key pages..." }));

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
        controller.enqueue(streamJsonLine({ type: "progress", message: "Ready — click Continue to extract data" }));

        // PHASE 2: Full analysis begins
        controller.enqueue(streamJsonLine({ 
          type: "progress", 
          message: "Scanning all pages (this may take 8–15 seconds)..." 
        }));

        logProgress(parseId, "Running AI vision model to locate final contract terms...");
        controller.enqueue(streamJsonLine({ 
          type: "progress", 
          message: "Running AI vision model to locate final contract terms..." 
        }));

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

        logProgress(parseId, `Found ${criticalImages.length} critical pages — extracting final terms...`);
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

        controller.enqueue(streamJsonLine({ 
          type: "progress", 
          message: "Extracting purchase price, buyer names, dates, and contingencies..." 
        }));
        logProgress(parseId, "Extracting purchase price, buyer names, dates, and contingencies...");

        // Trigger extraction in background
        const baseUrl = process.env.NEXT_PUBLIC_URL || "http://localhost:3000";
        fetch(`${baseUrl}/api/parse/extract/${parseId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }).catch(err => console.error("[preview] Failed to trigger extract:", err));

        controller.enqueue(streamJsonLine({ type: "extraction_started" }));
        controller.enqueue(streamJsonLine({ type: "done" }));
        controller.close();
      } catch (error: any) {
        console.error("[preview] Stream error:", error);
        controller.enqueue(streamJsonLine({ 
          type: "error", 
          message: error.message || "Analysis failed — please try again" 
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
    },
  });
}