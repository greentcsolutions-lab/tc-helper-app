// src/app/api/parse/preview/[parseId]/route.ts
// TWO-PASS OPTIMIZED: Preview at 290 DPI, classify at 120 DPI

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { renderPdfToPngZipUrl, downloadAndExtractZip } from "@/lib/pdf/renderer";
import { classifyCriticalPages } from "@/lib/extractor/classifier";
import { uploadProgress } from "@/lib/progress";
import { del } from "@vercel/blob";

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
    select: { 
      pdfBuffer: true, 
      status: true, 
      fileName: true,
      renderZipUrl: true,
    },
  });

  if (!parseRecord || parseRecord.status !== "RENDERED" || !parseRecord.pdfBuffer) {
    return new Response("Invalid or already processed document", { status: 400 });
  }

  const readable = new ReadableStream({
    async start(controller) {
      try {
        // PHASE 1: Stream preview pages for confirmation
        logProgress(parseId, "Loading preview pages for confirmation...");
        controller.enqueue(streamJsonLine({ 
          type: "progress", 
          message: "Loading preview pages for confirmation..." 
        }));

        // Download the 9-page preview ZIP created during upload
        if (!parseRecord.renderZipUrl) {
          throw new Error("Preview ZIP not found");
        }

        const previewPages = await downloadAndExtractZip(parseRecord.renderZipUrl);

        for (const page of previewPages) {
          controller.enqueue(streamJsonLine({
            type: "page",
            pageNumber: page.pageNumber,
            base64: page.base64,
            phase: "confirm",
          }));
        }

        controller.enqueue(streamJsonLine({ type: "confirm_ready" }));
        controller.enqueue(streamJsonLine({ 
          type: "progress", 
          message: "Ready – click Continue to extract data" 
        }));

        // PHASE 2: Full classification at LOW DPI (cost optimization)
        controller.enqueue(streamJsonLine({ 
          type: "progress", 
          message: "Scanning all pages at low resolution (8–15 seconds)..." 
        }));
        logProgress(parseId, "Rendering all pages at 120 DPI for classification...");

        // Render ALL pages at 120 DPI for classification
        const { url: classifyZipUrl, key: classifyZipKey } = await renderPdfToPngZipUrl(
          parseRecord.pdfBuffer!, 
          { dpi: 120 }  // Low DPI for classification = cost savings
        );

        const allPagesLowDpi = await downloadAndExtractZip(classifyZipUrl);

        logProgress(parseId, "Running AI vision model to locate final contract terms...");
        controller.enqueue(streamJsonLine({ 
          type: "progress", 
          message: "Running AI vision model to locate final contract terms..." 
        }));

        // Run classifier to find critical pages
        const { criticalImages, state, criticalPageNumbers } = await classifyCriticalPages(allPagesLowDpi);

        // Cleanup low-DPI classification ZIP (we don't need it anymore)
        await del(classifyZipKey).catch(err => 
          console.warn(`[preview:${parseId}] Failed to delete classification ZIP:`, err)
        );

        // Save critical page numbers to DB
        await db.parse.update({
          where: { id: parseId },
          data: {
            state: state || "Unknown",
            criticalPageNumbers,
            status: "READY_FOR_EXTRACT",
          },
        });

        logProgress(parseId, `Found ${criticalImages.length} critical pages – preparing extraction...`);
        controller.enqueue(streamJsonLine({
          type: "critical_start",
          count: criticalImages.length,
          state,
          criticalPageNumbers,
        }));

        // Stream low-res critical pages for display (optional, user feedback)
        for (const page of criticalImages) {
          controller.enqueue(streamJsonLine({
            type: "critical_page",
            pageNumber: page.pageNumber,
            base64: page.base64,
          }));
        }

        controller.enqueue(streamJsonLine({ 
          type: "progress", 
          message: "Critical pages identified – triggering high-resolution extraction..." 
        }));
        logProgress(parseId, "Triggering high-resolution extraction...");

        // Trigger extraction in background (will re-render critical pages at 290 DPI)
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
          message: error.message || "Analysis failed – please try again" 
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