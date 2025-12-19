// src/app/api/parse/process/[parseId]/route.ts
// Version: 2.6.0 - 2025-12-19
// CREDIT-SAVER MODE: After cropping footer strips, immediately throw error to exit early
// Saves ~50-70% of Grok vision credits during prompt/debug phase
// Remove this block when ready for full classification

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { renderPdfToPngZipUrl, downloadAndExtractZip } from "@/lib/pdf/renderer";
import { PDFDocument } from "pdf-lib";
import { put } from "@vercel/blob";
import JSZip from "jszip";

export const runtime = "nodejs";
export const maxDuration = 60;

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

  const parse = await db.parse.findUnique({
    where: { id: parseId },
    select: {
      id: true,
      userId: true,
      pdfBuffer: true,
      status: true,
      fileName: true,
    },
  });

  if (!parse || parse.status !== "PENDING") {
    return Response.json({ error: "Parse not ready" }, { status: 400 });
  }

  if (!parse.pdfBuffer) {
    return Response.json({ error: "PDF not found" }, { status: 500 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const pdfDoc = await PDFDocument.load(parse.pdfBuffer);
        const pageCount = pdfDoc.getPageCount();
        console.log(`[process:${parseId}] PDF loaded - ${pageCount} pages detected`);

        emit(controller, {
          type: "progress",
          message: "Rendering page footers for AI classification...",
          stage: "classify_render",
        });

        const { url: classifyZipUrl } = await renderPdfToPngZipUrl(
          parse.pdfBuffer,
          { 
            dpi: 160,
            footerOnly: true,
            totalPages: pageCount
          }
        );

        const footerImages = await downloadAndExtractZip(classifyZipUrl, { footerOnly: true });

        // CREDIT DEDUCTION (still charge for Nutrient render)
        await db.user.update({
          where: { id: parse.userId },
          data: { credits: { decrement: 1 } },
        });
        console.log(`[process:${parseId}] ✓ Credit deducted - rendered + cropped ${footerImages.length} footer strips`);

        // === CREDIT-SAVER EARLY EXIT ===
        // Upload debug ZIP and throw to stop classification/extraction
        console.log("[CREDIT-SAVER] Early exit after cropping — uploading debug ZIP");

        const zip = new JSZip();
        footerImages.forEach((img) => {
          const buffer = Buffer.from(img.base64.split(",")[1], "base64");
          const filename = `page-${img.pageNumber.toString().padStart(3, "0")}.png`;
          zip.file(filename, buffer);
        });

        const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
        const debugKey = `debug/footer-strips/${parseId}.zip`;
        const { url: debugZipUrl } = await put(debugKey, zipBuffer, {
          access: "public",
          addRandomSuffix: false,
        });

        console.log(`[CREDIT-SAVER] Cropped footer strips ZIP ready: ${debugZipUrl}`);

        emit(controller, {
          type: "debug_footer_zip",
          message: "Credit-saver mode: Early exit after cropping. Debug ZIP uploaded.",
          debugZipUrl,
        });

        // Throw to exit route immediately — no classification or extraction
        throw new Error("CREDIT-SAVER EARLY EXIT: Footer strips cropped and uploaded. Classification skipped to save Grok credits.");

        // === END OF EARLY EXIT BLOCK ===
        // When ready for full run, comment out or remove the block above

        // Normal flow continues below (will be skipped while early exit active)
        emit(controller, {
          type: "progress",
          message: `Analyzing ${footerImages.length} page footers with AI vision model...`,
          stage: "classify_ai",
        });

        // ... rest of classification, extraction, etc. unchanged ...

      } catch (error: any) {
        console.error(`[process:${parseId}] Failed:`, error.message || error);

        await db.parse.update({
          where: { id: parseId },
          data: {
            status: "EXTRACTION_FAILED",
            errorMessage: error.message || "Unknown error",
          },
        }).catch(() => {});

        emit(controller, {
          type: "error",
          message: error.message || "Extraction failed - please try again",
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