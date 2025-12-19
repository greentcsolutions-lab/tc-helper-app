// src/app/api/parse/process/[parseId]/route.ts
// Version: 2.5.0 - 2025-12-19
// ADDED: On classification failure, create and upload a ZIP containing all cropped footer strips
// Logs only the single debug ZIP URL (no individual blob URLs printed)

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { renderPdfToPngZipUrl, downloadAndExtractZip } from "@/lib/pdf/renderer";
import { classifyCriticalPages } from "@/lib/extractor/classifier";
import { extractFromCriticalPages } from "@/lib/extractor/extractor";
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
        //@ts-ignore
        const pdfDoc = await PDFDocument.load(parse.pdfBuffer);
        const pageCount = pdfDoc.getPageCount();
        console.log(`[process:${parseId}] PDF loaded - ${pageCount} pages detected`);

        emit(controller, {
          type: "progress",
          message: "Rendering page footers for AI classification...",
          stage: "classify_render",
        });

        const { url: classifyZipUrl } = await renderPdfToPngZipUrl(
          //@ts-ignore
          parse.pdfBuffer,
          { 
            dpi: 160,
            footerOnly: true,
            totalPages: pageCount
          }
        );

        const footerImages = await downloadAndExtractZip(classifyZipUrl, { footerOnly: true });

        await db.user.update({
          where: { id: parse.userId },
          data: { credits: { decrement: 1 } },
        });
        console.log(`[process:${parseId}] ✓ Credit deducted - rendered + cropped ${footerImages.length} footer strips`);

        emit(controller, {
          type: "progress",
          message: `Analyzing ${footerImages.length} page footers with AI vision model...`,
          stage: "classify_ai",
        });

        const { criticalPageNumbers, state } = await classifyCriticalPages(
          footerImages,
          pageCount
        );

        // NEW: If RPA pages not found, create a ZIP of all cropped footer strips and upload it
        const requiredRPAPages = [1, 2, 3, 16, 17];
        const foundRequired = requiredRPAPages.some(page => 
          criticalPageNumbers.includes(page)
        );

        if (criticalPageNumbers.length === 0 || !foundRequired) {
          console.log("[DEBUG] Required RPA pages not detected — creating debug ZIP of cropped footer strips");

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

          console.log(`[DEBUG] Cropped footer strips ZIP uploaded: ${debugZipUrl}`);

          emit(controller, {
            type: "debug_footer_zip",
            message: "Required RPA pages not found — debug ZIP of all cropped footer strips uploaded",
            debugZipUrl,
          });
        }

        emit(controller, {
          type: "progress",
          message: `Found ${criticalPageNumbers.length} critical pages - rendering at high quality...`,
          stage: "extract_render",
          criticalPageNumbers,
        });

        // ... rest of extraction pipeline unchanged ...

        const newPdf = await PDFDocument.create();
        //@ts-ignore
        const sourcePdf = await PDFDocument.load(parse.pdfBuffer);

        for (const pageNum of criticalPageNumbers) {
          const [copiedPage] = await newPdf.copyPages(sourcePdf, [pageNum - 1]);
          newPdf.addPage(copiedPage);
        }

        const criticalPagesPdfBuffer = Buffer.from(await newPdf.save());

        const { url: extractZipUrl } = await renderPdfToPngZipUrl(
          criticalPagesPdfBuffer,
          { dpi: 290, maxPages: criticalPageNumbers.length }
        );

        const criticalPagesHighRes = await downloadAndExtractZip(extractZipUrl);

        emit(controller, {
          type: "progress",
          message: "Extracting contract terms with Grok...",
          stage: "extract_ai",
        });

        const firstPass = await extractFromCriticalPages(criticalPagesHighRes);

        let finalResult = firstPass;
        const needsSecondPass =
          firstPass.confidence.overall_confidence < 80 ||
          firstPass.handwriting_detected;

        if (needsSecondPass) {
          emit(controller, {
            type: "progress",
            message: "Low confidence detected - running second extraction pass...",
            stage: "extract_ai_boost",
          });

          const secondPass = await extractFromCriticalPages(
            criticalPagesHighRes,
            firstPass.raw
          );
          finalResult = secondPass;
        }

        const needsReview =
          finalResult.confidence.overall_confidence < 80 ||
          finalResult.handwriting_detected ||
          (finalResult.confidence.purchase_price || 0) < 90 ||
          (finalResult.confidence.buyer_names || 0) < 90;

        await db.parse.update({
          where: { id: parseId },
          data: {
            status: needsReview ? "NEEDS_REVIEW" : "COMPLETED",
            state: state || "Unknown",
            criticalPageNumbers,
            rawJson: finalResult.raw,
            formatted: finalResult.extracted,
            renderZipUrl: extractZipUrl,
            finalizedAt: new Date(),
          },
        });

        console.log(`[process:${parseId}] ✓ Complete - confidence: ${finalResult.confidence.overall_confidence}%`);

        emit(controller, {
          type: "complete",
          extracted: finalResult.extracted,
          confidence: finalResult.confidence,
          criticalPageNumbers,
          zipUrl: extractZipUrl,
          needsReview,
        });

        controller.close();
      } catch (error: any) {
        console.error(`[process:${parseId}] Failed:`, error);

        await db.parse.update({
          where: { id: parseId },
          data: {
            status: "EXTRACTION_FAILED",
            errorMessage: error.message,
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