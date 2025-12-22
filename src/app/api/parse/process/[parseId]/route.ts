// src/app/api/parse/process/[parseId]/route.ts
// Version: 3.2.0 - 2025-12-22
// MAJOR UPDATE: Graceful pdf-lib fallback - owner-restricted PDFs now supported
// MAINTAINED: Page mapping integrity, all downstream processing unchanged

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
        console.log(`\n${"=".repeat(80)}`);
        console.log(`[process:${parseId}] 🚀 STARTING EXTRACTION PIPELINE`);
        console.log(`[process:${parseId}] File: ${parse.fileName}`);
        //@ts-ignore
        console.log(`[process:${parseId}] Buffer size: ${(parse.pdfBuffer.length / 1024).toFixed(2)} KB`);
        console.log(`${"=".repeat(80)}\n`);

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // PHASE 1: TRY TO GET PAGE COUNT (GRACEFUL FALLBACK ON FAILURE)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        
        let pageCount: number | null = null;
        let pdfLibFailed = false;
        
        try {
          console.log(`[process:${parseId}] Attempting pdf-lib page count detection...`);
          //@ts-ignore
          const pdfDoc = await PDFDocument.load(parse.pdfBuffer, { ignoreEncryption: true });
          pageCount = pdfDoc.getPageCount();
          console.log(`[process:${parseId}] ✓ pdf-lib: ${pageCount} pages detected\n`);
        } catch (pdfLibError: any) {
          pdfLibFailed = true;
          console.warn(`[process:${parseId}] ⚠️ pdf-lib failed: ${pdfLibError.message}`);
          console.log(`[process:${parseId}] This is likely an owner-restricted PDF (printing disabled, etc.)`);
          console.log(`[process:${parseId}] → Falling back to Nutrient auto-detection\n`);
          
          emit(controller, {
            type: "progress",
            message: "Detected owner-restricted PDF - using advanced processing...",
            stage: "pdf_lib_fallback",
          });
        }

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // PHASE 2: CLASSIFICATION RENDER (120 DPI, FULL PAGES)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        
        emit(controller, {
          type: "progress",
          message: "Converting your document for AI analysis...",
          stage: "classify_render",
        });

        console.log(`[process:${parseId}] PHASE 2: Classification render @ 120 DPI`);
        console.log(`[process:${parseId}] Page count hint: ${pageCount ?? "auto-detect"}`);

        const { url: classifyZipUrl } = await renderPdfToPngZipUrl(
          //@ts-ignore
          parse.pdfBuffer,
          { 
            dpi: 120,
            totalPages: pageCount ?? undefined // undefined = Nutrient auto-detects
          }
        );

        const fullPageImages = await downloadAndExtractZip(classifyZipUrl);
        
        // NOW we have the actual page count from Nutrient's output
        const actualPageCount = fullPageImages.length;
        console.log(`[process:${parseId}] ✓ Nutrient returned ${actualPageCount} pages`);
        
        // Verify page count consistency (if pdf-lib worked)
        if (pageCount !== null && pageCount !== actualPageCount) {
          console.warn(`[process:${parseId}] ⚠️ Page count mismatch: pdf-lib said ${pageCount}, Nutrient returned ${actualPageCount}`);
          console.log(`[process:${parseId}] → Using Nutrient's count (${actualPageCount}) as source of truth`);
        }
        
        // Use Nutrient's count as authoritative
        pageCount = actualPageCount;

        await db.user.update({
          where: { id: parse.userId },
          data: { credits: { decrement: 1 } },
        });
        console.log(`[process:${parseId}] ✓ Credit deducted - rendered ${fullPageImages.length} full pages @ 120 DPI\n`);

        emit(controller, {
          type: "progress",
          message: `Analyzing ${fullPageImages.length} pages to find critical sections...`,
          stage: "classify_ai",
        });

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // PHASE 3: CLASSIFICATION (MULTI-RPA AWARE)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        
        console.log(`[process:${parseId}] PHASE 3: Classification with Grok-4`);
        
        const { criticalPageNumbers, state, rpaBlocksDetected } = await classifyCriticalPages(
          fullPageImages,
          pageCount
        );

        // Log multi-RPA detection for user visibility
        if (rpaBlocksDetected.length > 1) {
          console.log(`[process:${parseId}] ⚠️ Multiple RPA blocks detected (${rpaBlocksDetected.length}) - likely COP scenario`);
          emit(controller, {
            type: "progress",
            message: `⚠️ Multiple RPA blocks detected (${rpaBlocksDetected.length}) - COP contingency?`,
            stage: "classify_multi_rpa",
          });
        }

        emit(controller, {
          type: "progress",
          message: `Found ${criticalPageNumbers.length} critical pages - rendering high-res versions...`,
          stage: "extract_render",
          criticalPageNumbers,
          rpaBlocksDetected: rpaBlocksDetected.map(b => ({
            startPage: b.startPage,
            confidence: b.confidence,
          })),
        });

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // PHASE 4: HIGH-RES EXTRACTION RENDER (325 DPI, CRITICAL PAGES ONLY)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        
        console.log(`[process:${parseId}] PHASE 4: Extracting critical pages for high-res render`);
        console.log(`[process:${parseId}] Pages: [${criticalPageNumbers.join(", ")}]`);

        // Create new PDF with only critical pages
        const newPdf = await PDFDocument.create();
        
        // Re-load source PDF (with encryption bypass if needed)
        let sourcePdf: any;
        try {
          //@ts-ignore
          sourcePdf = await PDFDocument.load(parse.pdfBuffer, { ignoreEncryption: true });
        } catch (loadError: any) {
          // If pdf-lib failed earlier, try without ignoreEncryption
          console.log(`[process:${parseId}] Retrying source PDF load without encryption flag...`);
          //@ts-ignore
          sourcePdf = await PDFDocument.load(parse.pdfBuffer);
        }

        for (const pageNum of criticalPageNumbers) {
          const [copiedPage] = await newPdf.copyPages(sourcePdf, [pageNum - 1]);
          newPdf.addPage(copiedPage);
        }

        const criticalPagesPdfBuffer = Buffer.from(await newPdf.save());
        console.log(`[process:${parseId}] ✓ Extracted ${criticalPageNumbers.length} pages into new PDF (${(criticalPagesPdfBuffer.length / 1024).toFixed(0)} KB)`);

        const { url: extractZipUrl, key: extractZipKey } = await renderPdfToPngZipUrl(
          criticalPagesPdfBuffer,
          { dpi: 325, maxPages: criticalPageNumbers.length }
        );

        const criticalPagesHighRes = await downloadAndExtractZip(extractZipUrl);

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // PHASE 5: BUILD PAGE LABELS (MAINTAINS ORIGINAL PDF PAGE NUMBERS)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        
        console.log(`[process:${parseId}] PHASE 5: Building page labels for extraction`);
        
        const pageLabels: Record<number, string> = {};

        const primaryBlock = rpaBlocksDetected[0];
        if (primaryBlock?.detectedPages) {
          const d = primaryBlock.detectedPages;
          if (d.page1) pageLabels[d.page1] = "RPA PAGE 1 OF 17";
          if (d.page2) pageLabels[d.page2] = "RPA PAGE 2 OF 17 (CONTINGENCIES)";
          if (d.page3) pageLabels[d.page3] = "RPA PAGE 3 OF 17 (ITEMS INCLUDED & HOME WARRANTY)";
          if (d.page16) pageLabels[d.page16] = "RPA PAGE 16 OF 17 (SIGNATURES)";
          if (d.page17) pageLabels[d.page17] = "RPA PAGE 17 OF 17 (BROKER INFO)";
        }

        // Mark remaining critical pages as counters/addenda
        criticalPageNumbers.forEach(pdfPage => {
          if (!pageLabels[pdfPage]) {
            pageLabels[pdfPage] = "COUNTER OFFER OR ADDENDUM";
          }
        });

        // CRITICAL: Map extracted PDF image index to ORIGINAL PDF page number
        const labeledCriticalImages = criticalPagesHighRes.map((img, index) => {
          const originalPdfPage = criticalPageNumbers[index]; // Position → Original page
          const label = pageLabels[originalPdfPage] || `PDF PAGE ${originalPdfPage}`;

          console.log(`[process:${parseId}] Image ${index + 1} = PDF Page ${originalPdfPage} → ${label}`);

          return {
            pageNumber: originalPdfPage, // Use ORIGINAL page number
            base64: img.base64,
            label: label,
          };
        });

        console.log(`[process:${parseId}] ✓ Page mapping preserved: ${labeledCriticalImages.length} images labeled\n`);

        emit(controller, {
          type: "progress",
          message: "Extracting contract terms with Grok AI...",
          stage: "extract_ai",
        });

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // PHASE 6: AI EXTRACTION (WITH SCHEMA VALIDATION HANDLING)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        
        console.log(`[process:${parseId}] PHASE 6: AI extraction (first pass)`);
        
        let finalResult;
        let schemaValidationFailed = false;

        try {
          const firstPass = await extractFromCriticalPages(labeledCriticalImages);
          finalResult = firstPass;

          console.log(`[process:${parseId}] ✓ First pass complete`);
          console.log(`[process:${parseId}] Property: ${firstPass.data.propertyAddress}`);
          console.log(`[process:${parseId}] Price: $${firstPass.data.purchasePrice.toLocaleString()}`);

          // Check if schema validation failed
          if (firstPass.needsReview) {
            schemaValidationFailed = true;
            console.warn(`[process:${parseId}] ⚠️ First pass flagged for review`);
          }

          // Determine if second pass needed
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

              // Check if second pass resolved issues
              if (!secondPass.needsReview) {
                schemaValidationFailed = false;
                console.log(`[process:${parseId}] ✓ Second pass resolved validation issues`);
              }
            } catch (secondPassError: any) {
              console.warn(`[process:${parseId}] Second pass failed, keeping first pass:`, secondPassError.message);
              // Keep first pass result
            }
          }

        } catch (extractionError: any) {
          // Complete extraction failure
          throw extractionError;
        }

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // PHASE 7: DETERMINE FINAL STATUS
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        
        const needsReview = finalResult.needsReview;
        const finalStatus = needsReview ? "NEEDS_REVIEW" : "COMPLETED";

        console.log(`\n[process:${parseId}] PHASE 7: Finalizing extraction`);
        console.log(`[process:${parseId}] Final status: ${finalStatus}`);
        if (schemaValidationFailed) {
          console.warn(`[process:${parseId}] ⚠️ Marked as NEEDS_REVIEW due to validation issues`);
        }

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // PHASE 8: SAVE RESULTS TO DATABASE
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        
        await db.parse.update({
          where: { id: parseId },
          data: {
            status: finalStatus,
            state: state || "Unknown",
            criticalPageNumbers,
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
              },
            },
            formatted: finalResult.data as any,
            renderZipUrl: extractZipUrl,
            renderZipKey: extractZipKey,
            finalizedAt: new Date(),
          },
        });

        console.log(`[process:${parseId}] ✓ Results saved to database`);
        if (rpaBlocksDetected.length > 1) {
          console.log(`[process:${parseId}] ✓ Stored ${rpaBlocksDetected.length} RPA block metadata for review`);
        }

        console.log(`\n${"=".repeat(80)}`);
        console.log(`[process:${parseId}] ✅ EXTRACTION COMPLETE`);
        console.log(`[process:${parseId}] Status: ${finalStatus}`);
        console.log(`[process:${parseId}] Critical pages: ${criticalPageNumbers.length}`);
        console.log(`[process:${parseId}] RPA blocks: ${rpaBlocksDetected.length}`);
        console.log(`${"=".repeat(80)}\n`);

        emit(controller, {
          type: "complete",
          extracted: finalResult.data,
          criticalPageNumbers,
          zipUrl: extractZipUrl,
          needsReview,
          rpaBlocksDetected: rpaBlocksDetected.length,
        });

        controller.close();

      } catch (error: any) {
        console.error(`\n[process:${parseId}] ❌ EXTRACTION FAILED:`, error);
        console.error(`[process:${parseId}] Stack trace:`, error.stack);

        // Determine error message based on error type
        let errorMessage = error.message || "Extraction failed - please try again";
        let errorDetails = null;

        if (error.message?.includes("PDF_PASSWORD_PROTECTED")) {
          errorMessage = "This PDF is password-protected";
          errorDetails = "Please provide an unlocked version or remove the password before uploading.";
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