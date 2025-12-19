// src/app/api/parse/process/[parseId]/route.ts
// Version: 2.7.0 - 2025-12-19
// FULL PRODUCTION MODE: Complete pipeline runs end-to-end
// No debug ZIP upload, no early exit, no extra logs for cropped images

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { renderPdfToPngZipUrl, downloadAndExtractZip } from "@/lib/pdf/renderer";
import { classifyCriticalPages } from "@/lib/extractor/classifier";
import { extractFromCriticalPages } from "@/lib/extractor/extractor";
import { PDFDocument } from "pdf-lib";

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

        // PHASE 1: Footer-only classification render
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

        const footerImages = await downloadAndExtractZip(classifyZipUrl, { 
            footerOnly: true,
            dpi: 160  // ← Pass the DPI we rendered at
        });

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

        // PHASE 2: Classification
        const { criticalPageNumbers, state } = await classifyCriticalPages(
          footerImages,
          pageCount
        );

        emit(controller, {
          type: "progress",
          message: `Found ${criticalPageNumbers.length} critical pages - rendering at high quality...`,
          stage: "extract_render",
          criticalPageNumbers,
        });

        // PHASE 3: High-res extraction render
        console.log(`[process:${parseId}] Creating new PDF with pages: [${criticalPageNumbers.join(", ")}]`);

        const newPdf = await PDFDocument.create();
        //@ts-ignore
        const sourcePdf = await PDFDocument.load(parse.pdfBuffer);

        for (const pageNum of criticalPageNumbers) {
          const [copiedPage] = await newPdf.copyPages(sourcePdf, [pageNum - 1]);
          newPdf.addPage(copiedPage);
        }

        const criticalPagesPdfBuffer = Buffer.from(await newPdf.save());
        console.log(`[process:${parseId}] ✓ Extracted ${criticalPageNumbers.length} pages into new PDF (${(criticalPagesPdfBuffer.length / 1024).toFixed(0)} KB)`);

        const { url: extractZipUrl, key: extractZipKey } = await renderPdfToPngZipUrl(
          criticalPagesPdfBuffer,
          { dpi: 200, maxPages: criticalPageNumbers.length } // 200 DPI plenty for most digital extractions
        );

        const criticalPagesHighRes = await downloadAndExtractZip(extractZipUrl);

        emit(controller, {
          type: "progress",
          message: "Extracting contract terms with Grok...",
          stage: "extract_ai",
        });

        // PHASE 4: Extraction
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

        // PHASE 5: Save results
        await db.parse.update({
          where: { id: parseId },
          data: {
            status: needsReview ? "NEEDS_REVIEW" : "COMPLETED",
            state: state || "Unknown",
            criticalPageNumbers,
            rawJson: finalResult.raw,
            formatted: finalResult.extracted,
            renderZipUrl: extractZipUrl,
            renderZipKey: extractZipKey,
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