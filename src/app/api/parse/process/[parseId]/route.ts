// src/app/api/parse/process/[parseId]/route.ts
// Version: 4.0.0 - 2025-12-23
// PHASE 1: Parallel dual-DPI rendering with selective high-res extraction
// MAINTAINED: California-specific logic, backward compatible

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { 
  renderPdfParallel, 
  downloadAndExtractZip,
  extractSpecificPagesFromZip 
} from "@/lib/pdf/renderer";
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
        console.log(`\n${"=".repeat(80)}`);
        console.log(`[process:${parseId}] 🚀 PHASE 1 EXTRACTION PIPELINE`);
        console.log(`[process:${parseId}] File: ${parse.fileName}`);
        console.log(`[process:${parseId}] Strategy: Parallel dual-DPI rendering`);
        //@ts-ignore
        console.log(`[process:${parseId}] Buffer size: ${(parse.pdfBuffer.length / 1024).toFixed(2)} KB`);
        console.log(`${"=".repeat(80)}\n`);

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // PHASE 1A: GET PAGE COUNT (GRACEFUL FALLBACK)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        
        let pageCount: number | null = null;
        let pdfLibFailed = false;
        
        try {
          console.log(`[process:${parseId}] Attempting pdf-lib page count detection...`);
          //@ts-ignore
          const pdfDoc = await PDFDocument.load(parse.pdfBuffer, { ignoreEncryption: true });
          pageCount = pdfDoc.getPageCount();
          console.log(`[process:${parseId}] ✓ pdf-lib: ${pageCount} pages detected`);
          
          // Validate page limit (100 pages max)
          if (pageCount > 100) {
            throw new Error(`Document exceeds 100-page limit (${pageCount} pages)`);
          }
          
        } catch (pdfLibError: any) {
          if (pdfLibError.message.includes("exceeds 100-page limit")) {
            throw pdfLibError; // Don't catch page limit errors
          }
          
          pdfLibFailed = true;
          console.warn(`[process:${parseId}] ⚠️ pdf-lib failed: ${pdfLibError.message}`);
          console.log(`[process:${parseId}] Likely owner-restricted PDF - Nutrient will auto-detect`);
          
          emit(controller, {
            type: "progress",
            message: "Detected owner-restricted PDF - using advanced processing...",
            stage: "pdf_lib_fallback",
          });
        }

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // PHASE 1B: PARALLEL DUAL-DPI RENDER (COST SAVER)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        
        emit(controller, {
          type: "progress",
          message: "Rendering document in parallel (150 DPI + 300 DPI)...",
          stage: "render_parallel",
        });

        console.log(`[process:${parseId}] PHASE 1B: Parallel dual-DPI render`);
        console.log(`[process:${parseId}] Page count hint: ${pageCount ?? "auto-detect"}`);

        const renderResult = await renderPdfParallel(
          //@ts-ignore
          parse.pdfBuffer,
          pageCount ?? undefined
        );

        // Update page count from render result
        pageCount = renderResult.pageCount;
        
        console.log(`[process:${parseId}] ✓ Parallel render complete:`);
        console.log(`[process:${parseId}]   • ${pageCount} pages detected`);
        console.log(`[process:${parseId}]   • Low-res (150 DPI): ${renderResult.lowRes.key}`);
        console.log(`[process:${parseId}]   • High-res (300 DPI): ${renderResult.highRes.key}`);

        // Deduct credit after successful render
        await db.user.update({
          where: { id: parse.userId },
          data: { credits: { decrement: 1 } },
        });
        console.log(`[process:${parseId}] ✓ Credit deducted`);

        // Store both ZIPs in database
        await db.parse.update({
          where: { id: parseId },
          data: {
            status: "RENDERED",
            pageCount,
            lowResZipUrl: renderResult.lowRes.url,
            lowResZipKey: renderResult.lowRes.key,
            highResZipUrl: renderResult.highRes.url,
            highResZipKey: renderResult.highRes.key,
            pdfBuffer: null, // Delete original PDF buffer
          },
        });

        emit(controller, {
          type: "progress",
          message: `Analyzing ${pageCount} pages to identify critical sections...`,
          stage: "classify_ai",
        });

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // PHASE 1C: CLASSIFICATION (FULL LOW-RES SWEEP)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        
        console.log(`[process:${parseId}] PHASE 1C: Classification @ 150 DPI`);
        
        const fullPageImages = await downloadAndExtractZip(renderResult.lowRes.url);
        
        const { criticalPageNumbers, state, rpaBlocksDetected } = await classifyCriticalPages(
          fullPageImages,
          pageCount
        );

        console.log(`[process:${parseId}] ✓ Classification complete:`);
        console.log(`[process:${parseId}]   • State: ${state}`);
        console.log(`[process:${parseId}]   • Critical pages: ${criticalPageNumbers.length} → [${criticalPageNumbers.join(", ")}]`);
        console.log(`[process:${parseId}]   • RPA blocks: ${rpaBlocksDetected.length}`);

        if (rpaBlocksDetected.length > 1) {
          console.log(`[process:${parseId}] ⚠️ Multiple RPA blocks (${rpaBlocksDetected.length}) - likely COP scenario`);
          emit(controller, {
            type: "progress",
            message: `⚠️ Multiple RPA blocks detected (${rpaBlocksDetected.length}) - COP contingency?`,
            stage: "classify_multi_rpa",
          });
        }

        // Update database with classification results
        await db.parse.update({
          where: { id: parseId },
          data: {
            status: "READY_FOR_EXTRACT",
            state: state || "Unknown",
            criticalPageNumbers,
            lowResZipUrl: null, // Delete low-res ZIP - no longer needed
            lowResZipKey: null,
          },
        });

        emit(controller, {
          type: "progress",
          message: `Extracting ${criticalPageNumbers.length} critical pages at high resolution...`,
          stage: "extract_selective",
          criticalPageNumbers,
        });

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // PHASE 1D: SELECTIVE HIGH-RES EXTRACTION (MAJOR COST SAVER)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        
        console.log(`[process:${parseId}] PHASE 1D: Selective high-res extraction`);
        console.log(`[process:${parseId}] Extracting ${criticalPageNumbers.length}/${pageCount} pages (${((criticalPageNumbers.length / pageCount) * 100).toFixed(1)}% of document)`);

        // Extract only critical pages from high-res ZIP
        const criticalPagesHighRes = await extractSpecificPagesFromZip(
          renderResult.highRes.url,
          criticalPageNumbers
        );

        console.log(`[process:${parseId}] ✓ Extracted ${criticalPagesHighRes.length} critical pages @ 300 DPI`);

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // PHASE 1E: BUILD PAGE LABELS (CALIFORNIA-SPECIFIC)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        
        console.log(`[process:${parseId}] PHASE 1E: Building page labels for extraction`);
        
        const pageLabels: Record<number, string> = {};

        const primaryBlock = rpaBlocksDetected[0];
        if (primaryBlock?.detectedPages) {
          const d = primaryBlock.detectedPages;
          if (d.page1) pageLabels[d.page1] = "RPA PAGE 1 OF 17 (ADDRESS, PRICE, FINANCING & CLOSING)";
          if (d.page2) pageLabels[d.page2] = "RPA PAGE 2 OF 17 (CONTINGENCIES)";
          if (d.page3) pageLabels[d.page3] = "RPA PAGE 3 OF 17 (ITEMS INCLUDED & HOME WARRANTY)";
          if (d.page16) pageLabels[d.page16] = "RPA PAGE 16 OF 17 (SIGNATURES)";
          if (d.page17) pageLabels[d.page17] = "RPA PAGE 17 OF 17 (BROKER INFO)";
        }

        criticalPageNumbers.forEach(pdfPage => {
          if (!pageLabels[pdfPage]) {
            pageLabels[pdfPage] = "COUNTER OFFER OR ADDENDUM";
          }
        });

        const labeledCriticalImages = criticalPagesHighRes.map((img) => {
          const label = pageLabels[img.pageNumber] || `PDF PAGE ${img.pageNumber}`;
          return {
            pageNumber: img.pageNumber,
            base64: img.base64,
            label: label,
          };
        });

        console.log(`[process:${parseId}] ✓ Page mapping complete: ${labeledCriticalImages.length} images labeled`);

        emit(controller, {
          type: "progress",
          message: "Extracting contract terms with Grok AI...",
          stage: "extract_ai",
        });

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // PHASE 1F: AI EXTRACTION (CALIFORNIA SCHEMA)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        
        console.log(`[process:${parseId}] PHASE 1F: AI extraction (California schema)`);
        
        let finalResult;
        let schemaValidationFailed = false;

        try {
          const firstPass = await extractFromCriticalPages(labeledCriticalImages);
          finalResult = firstPass;

          console.log(`[process:${parseId}] ✓ First pass complete`);
          console.log(`[process:${parseId}] Property: ${firstPass.data.propertyAddress}`);
          console.log(`[process:${parseId}] Price: $${firstPass.data.purchasePrice.toLocaleString()}`);

          if (firstPass.needsReview) {
            schemaValidationFailed = true;
            console.warn(`[process:${parseId}] ⚠️ First pass flagged for review`);
          }

          const needsSecondPass = firstPass.needsReview;

          if (needsSecondPass) {
            emit(controller, {
              type: "progress",
              message: "Running verification pass to improve accuracy...",
              stage: "extract_ai_boost",
            });

            console.log(`[process:${parseId}] Running second pass for quality improvement...`);

            try {
              const secondPass = await extractFromCriticalPages(
                labeledCriticalImages,
                firstPass.data
              );
              finalResult = secondPass;
              console.log(`[process:${parseId}] ✓ Second pass complete`);

              if (!secondPass.needsReview) {
                schemaValidationFailed = false;
                console.log(`[process:${parseId}] ✓ Second pass resolved validation issues`);
              }
            } catch (secondPassError: any) {
              console.warn(`[process:${parseId}] Second pass failed, keeping first pass:`, secondPassError.message);
            }
          }

        } catch (extractionError: any) {
          throw extractionError;
        }

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // PHASE 1G: FINALIZE & CLEANUP
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        
        const needsReview = finalResult.needsReview;
        const finalStatus = needsReview ? "NEEDS_REVIEW" : "COMPLETED";

        console.log(`\n[process:${parseId}] PHASE 1G: Finalizing extraction`);
        console.log(`[process:${parseId}] Final status: ${finalStatus}`);
        if (schemaValidationFailed) {
          console.warn(`[process:${parseId}] ⚠️ Marked as NEEDS_REVIEW due to validation issues`);
        }

        await db.parse.update({
          where: { id: parseId },
          data: {
            status: finalStatus,
            rawJson: {
              ...finalResult.raw,
              _classification_meta: {
                rpaBlocksDetected: rpaBlocksDetected.length,
                rpaBlocks: rpaBlocksDetected.map(b => ({
                  startPage: b.startPage,
                  confidence: b.confidence,
                  pages: b.pages,
                })),
                pdfLibWorked: !pdfLibFailed,
                actualPageCount: pageCount,
                phase1_selective_extraction: {
                  totalPages: pageCount,
                  criticalPages: criticalPageNumbers.length,
                  extractionRatio: `${((criticalPageNumbers.length / pageCount) * 100).toFixed(1)}%`,
                },
              },
            },
            formatted: finalResult.data as any,
            highResZipUrl: null, // Delete high-res ZIP - extraction complete
            highResZipKey: null,
            finalizedAt: new Date(),
          },
        });

        console.log(`[process:${parseId}] ✓ Results saved to database`);
        console.log(`[process:${parseId}] ✓ All temporary files marked for deletion`);

        console.log(`\n${"=".repeat(80)}`);
        console.log(`[process:${parseId}] ✅ PHASE 1 EXTRACTION COMPLETE`);
        console.log(`[process:${parseId}] Status: ${finalStatus}`);
        console.log(`[process:${parseId}] Total pages: ${pageCount}`);
        console.log(`[process:${parseId}] Critical pages extracted: ${criticalPageNumbers.length} (${((criticalPageNumbers.length / pageCount) * 100).toFixed(1)}%)`);
        console.log(`[process:${parseId}] RPA blocks: ${rpaBlocksDetected.length}`);
        console.log(`[process:${parseId}] Cost savings: ${((1 - criticalPageNumbers.length / pageCount) * 100).toFixed(1)}% reduction in high-res processing`);
        console.log(`${"=".repeat(80)}\n`);

        emit(controller, {
          type: "complete",
          extracted: finalResult.data,
          criticalPageNumbers,
          needsReview,
          rpaBlocksDetected: rpaBlocksDetected.length,
          phase1Stats: {
            totalPages: pageCount,
            criticalPages: criticalPageNumbers.length,
            extractionRatio: `${((criticalPageNumbers.length / pageCount) * 100).toFixed(1)}%`,
            costSavings: `${((1 - criticalPageNumbers.length / pageCount) * 100).toFixed(1)}%`,
          },
        });

        controller.close();

      } catch (error: any) {
        console.error(`\n[process:${parseId}] ❌ EXTRACTION FAILED:`, error);
        console.error(`[process:${parseId}] Stack trace:`, error.stack);

        let errorMessage = error.message || "Extraction failed - please try again";
        let errorDetails = null;

        if (error.message?.includes("PDF_PASSWORD_PROTECTED")) {
          errorMessage = "This PDF is password-protected";
          errorDetails = "Please provide an unlocked version or remove the password before uploading.";
        } else if (error.message?.includes("exceeds 100-page limit")) {
          errorMessage = "Document too large";
          errorDetails = error.message;
        } else if (error.message?.includes("schema validation")) {
          errorMessage = "Data format validation failed";
          errorDetails = "Document may have unusual formatting. Please review manually or contact support.";
        } else if (error.message?.includes("Invalid PDF")) {
          errorMessage = "Invalid PDF file";
          errorDetails = "The uploaded file may be corrupted or not a valid PDF.";
        }

        await db.parse.update({
          where: { id: parseId },
          data: {
            status: "EXTRACTION_FAILED",
            errorMessage,
            rawJson: {
              _error: errorMessage,
              _error_details: errorDetails,
              _stack: error.stack,
              _timestamp: new Date().toISOString(),
            },
          },
        }).catch(() => {});

        emit(controller, {
          type: "error",
          message: errorMessage,
          details: errorDetails,
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