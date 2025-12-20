// src/app/api/parse/process/[parseId]/route.ts
// Version: 3.0.1 - 2025-12-20
// UPDATED: Passes explicit RPA page labels to extraction phase

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { renderPdfToPngZipUrl, downloadAndExtractZip } from "@/lib/pdf/renderer";
import { classifyCriticalPages } from "@/lib/extractor/classifier";
import { extractFromCriticalPages } from "@/lib/extractor/extractor";
import { PDFDocument } from "pdf-lib";

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

        // PHASE 1: Classification render at 120 DPI (full pages)
        emit(controller, {
          type: "progress",
          message: "Making your packet easier for Grok to read...",
          stage: "classify_render",
        });

        const { url: classifyZipUrl } = await renderPdfToPngZipUrl(
          //@ts-ignore
          parse.pdfBuffer,
          { 
            dpi: 120,
            totalPages: pageCount
          }
        );

        const fullPageImages = await downloadAndExtractZip(classifyZipUrl);

        await db.user.update({
          where: { id: parse.userId },
          data: { credits: { decrement: 1 } },
        });
        console.log(`[process:${parseId}] ✓ Credit deducted - rendered ${fullPageImages.length} full pages @ 120 DPI`);

        emit(controller, {
          type: "progress",
          message: `Looking through ${fullPageImages.length} pages for the important stuff...`,
          stage: "classify_ai",
        });

        // PHASE 2: Classification (Multi-RPA aware)
        const { criticalPageNumbers, state, rpaBlocksDetected } = await classifyCriticalPages(
          fullPageImages,
          pageCount
        );

        // Log multi-RPA detection for user visibility
        if (rpaBlocksDetected.length > 1) {
          emit(controller, {
            type: "progress",
            message: `⚠️ Multiple RPA blocks detected (${rpaBlocksDetected.length}) - COP?`,
            stage: "classify_multi_rpa",
          });
        }

        emit(controller, {
          type: "progress",
          message: `Found ${criticalPageNumbers.length} critical pages - pulling them now...`,
          stage: "extract_render",
          criticalPageNumbers,
          rpaBlocksDetected: rpaBlocksDetected.map(b => ({
            startPage: b.startPage,
            confidence: b.confidence,
          })),
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
          { dpi: 250, maxPages: criticalPageNumbers.length } // bumped to 250 for extra clarity
        );

        const criticalPagesHighRes = await downloadAndExtractZip(extractZipUrl);

        // ███████████████████████████████████████████████████████████
        // NEW: Build explicit human-readable labels for extraction
        // ███████████████████████████████████████████████████████████
        const pageLabels: Record<number, string> = {};

        // Use the first (primary) RPA block for precise labeling
        const primaryBlock = rpaBlocksDetected[0];
        if (primaryBlock?.detectedPages) {
          const d = primaryBlock.detectedPages;
          if (d.page1) pageLabels[d.page1] = "RPA PAGE 1 OF 17";
          if (d.page2) pageLabels[d.page2] = "RPA PAGE 2 OF 17 (CONTINGENCIES)";
          if (d.page3) pageLabels[d.page3] = "RPA PAGE 3 OF 17 (ITEMS INCLUDED & HOME WARRANTY)";
          if (d.page16) pageLabels[d.page16] = "RPA PAGE 16 OF 17 (SIGNATURES)";
          if (d.page17) pageLabels[d.page17] = "RPA PAGE 17 OF 17 (BROKER INFO)";
        }

        // All remaining critical pages = counters or addenda
        criticalPageNumbers.forEach(pdfPage => {
          if (!pageLabels[pdfPage]) {
            pageLabels[pdfPage] = "COUNTER OFFER OR ADDENDUM";
          }
        });

        // Attach labels to images
        const labeledCriticalImages = criticalPagesHighRes.map(img => ({
          pageNumber: img.pageNumber,
          base64: img.base64,
          label: pageLabels[img.pageNumber] || `PDF PAGE ${img.pageNumber}`,
        }));

        emit(controller, {
          type: "progress",
          message: "Extracting terms with Grok...",
          stage: "extract_ai",
        });

        // PHASE 4: Extraction
        const firstPass = await extractFromCriticalPages(labeledCriticalImages);

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
            labeledCriticalImages,
            firstPass.raw
          );
          finalResult = secondPass;
        }

        const needsReview =
          finalResult.confidence.overall_confidence < 80 ||
          finalResult.handwriting_detected ||
          (finalResult.confidence.purchase_price || 0) < 90 ||
          (finalResult.confidence.buyer_names || 0) < 90;

        // PHASE 5: Save results with RPA block metadata
        await db.parse.update({
          where: { id: parseId },
          data: {
            status: needsReview ? "NEEDS_REVIEW" : "COMPLETED",
            state: state || "Unknown",
            criticalPageNumbers,
            rawJson: {
              ...finalResult.raw,
              // Store classification metadata
              _classification_meta: {
                rpaBlocksDetected: rpaBlocksDetected.length,
                rpaBlocks: rpaBlocksDetected.map(b => ({
                  startPage: b.startPage,
                  confidence: b.confidence,
                  pages: b.pages,
                })),
              },
            },
            formatted: finalResult.extracted,
            renderZipUrl: extractZipUrl,
            renderZipKey: extractZipKey,
            finalizedAt: new Date(),
          },
        });

        console.log(`[process:${parseId}] ✓ Complete - confidence: ${finalResult.confidence.overall_confidence}%`);
        if (rpaBlocksDetected.length > 1) {
          console.log(`[process:${parseId}] ✓ Stored ${rpaBlocksDetected.length} RPA block metadata for review`);
        }

        emit(controller, {
          type: "complete",
          extracted: finalResult.extracted,
          confidence: finalResult.confidence,
          criticalPageNumbers,
          zipUrl: extractZipUrl,
          needsReview,
          rpaBlocksDetected: rpaBlocksDetected.length,
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