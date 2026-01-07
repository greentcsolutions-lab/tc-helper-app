// src/app/api/parse/classify/[parseId]/route.ts
// Version: 3.0.0 - 2026-01-07
// CONSOLIDATED CLASSIFY ROUTE
// - Eliminates separate render route entirely
// - Direct original PDF → temporary public Vercel Blob → Mistral /v1/ocr with classifier schema
// - Credit deduction moved here (classify now owns the cost)
// - Runs universal post-processor (unchanged v3.7.0)
// - Saves classificationCache, criticalPageNumbers, pdfPublicUrl (for extraction phase)
// - Output identical to previous classify route (SSE events + complete payload)

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { put } from "@vercel/blob"; 
import { callMistralClassify } from "@/lib/extraction/mistral/classifyPdf";
import {
  getCriticalPageNumbers,
  buildUniversalPageLabels,
  extractPackageMetadata,
} from "@/lib/extraction/classify/post-processor";
import { logSuccess, logError, logStep } from "@/lib/debug/parse-logger";

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

  const stream = new ReadableStream({
    async start(controller) {
      try {
        logStep("CLASSIFY:1", "Validating parse record and deducting credit...");

        const parse = await db.parse.findUnique({
          where: { id: parseId },
          select: {
            id: true,
            userId: true,
            status: true,
            pdfBuffer: true,
            pageCount: true,
            fileName: true,
            user: { select: { clerkId: true, credits: true } },
          },
        });

        if (!parse) {
          throw new Error("Parse not found");
        }

        if (parse.user.clerkId !== clerkUserId) {
          throw new Error("Unauthorized");
        }

        // Derive pageCount from PDF buffer if missing (upload route doesn't set it)
        let pageCount = parse.pageCount;
        if (!pageCount && parse.pdfBuffer) {
          // Attempt 1: pdf-lib (robust for most PDFs)
          try {
            const { PDFDocument } = await import("pdf-lib");
            const pdfDoc = await PDFDocument.load(parse.pdfBuffer);
            pageCount = pdfDoc.getPageCount();
            await db.parse.update({ where: { id: parseId }, data: { pageCount } });
            logSuccess("CLASSIFY:1", `Derived pageCount=${pageCount} from PDF via pdf-lib`);
          } catch (err) {
            logStep("CLASSIFY:1", "pdf-lib failed to derive pageCount, trying text-scans and pdfjs fallbacks...");
            // Attempt 2: Text-based scans (latin1) - multiple heuristics
            try {
              const bufferStr = parse.pdfBuffer.toString("latin1");
              const typePageMatches = (bufferStr.match(/\/Type\s*\/Page\b/g) || []).length;
              const plainPageMatches = (bufferStr.match(/\/Page\b/g) || []).length;
              const countMatch = bufferStr.match(/\/Count\s+(\d+)/);
              if (typePageMatches > 0) {
                pageCount = typePageMatches;
                await db.parse.update({ where: { id: parseId }, data: { pageCount } });
                logSuccess("CLASSIFY:1", `Fallback derived pageCount=${pageCount} by scanning "/Type /Page" (${typePageMatches} matches)`);
              } else if (countMatch) {
                pageCount = Number.parseInt(countMatch[1], 10);
                await db.parse.update({ where: { id: parseId }, data: { pageCount } });
                logSuccess("CLASSIFY:1", `Fallback derived pageCount=${pageCount} from "/Count"`);
              } else if (plainPageMatches > 0) {
                pageCount = plainPageMatches;
                await db.parse.update({ where: { id: parseId }, data: { pageCount } });
                logSuccess("CLASSIFY:1", `Fallback derived pageCount=${pageCount} by scanning "/Page" (${plainPageMatches} matches)`);
              }
            } catch (scanErr) {
              // ignore here; we'll try pdfjs next
            }

           // Attempt 3: pdfjs (pdfjs-dist) - robust for tricky PDFs
            if (!pageCount) {
              try {
                const pdfjs = await import("pdfjs-dist/legacy/build/pdf.js");
                // Convert Node Buffer -> Uint8Array for pdfjs
                const uint8 = new Uint8Array(
                  parse.pdfBuffer.buffer,
                  parse.pdfBuffer.byteOffset,
                  parse.pdfBuffer.byteLength
                );
                const loadingTask = pdfjs.getDocument({ data: uint8 });
                const pdfDoc = await loadingTask.promise;
                pageCount = pdfDoc.numPages;
                await db.parse.update({ where: { id: parseId }, data: { pageCount } });
                logSuccess("CLASSIFY:1", `Derived pageCount=${pageCount} using pdfjs-dist fallback`);
              } catch (pdfjsErr) {
                // Last-resort debug: log some counts and a small buffer sample
                try {
                  const sample = parse.pdfBuffer.slice(0, 512).toString("latin1").replace(/\n/g, "\\n");
                  console.warn(`[CLASSIFY:1] Fallbacks failed. sample[0..512]: "${sample}"`);
                } catch (_) {}
                logError("CLASSIFY:1", `All pageCount derivation attempts failed: ${String(pdfjsErr)}`);
              }
            }
          }
        }

        if (!parse.pdfBuffer || !pageCount) {
          throw new Error("Missing PDF buffer or page count");
        }

        // Deduct credit here – classification is now the paid step
        if (parse.user.credits < 1) {
          throw new Error("Insufficient credits");
        }

        await db.user.update({
          where: { clerkId: clerkUserId },
          data: { credits: { decrement: 1 } },
        });

        logSuccess("CLASSIFY:1", `Credit deducted – processing ${parse.fileName} (${pageCount} pages)`);

        logStep("CLASSIFY:2", "Verifying uploaded PDF URL (upload route must provide pdfPublicUrl)...");
        const dbParse = await db.parse.findUnique({ where: { id: parseId }, select: { pdfPublicUrl: true } });
        const pdfPublicUrl = dbParse?.pdfPublicUrl;
        if (!pdfPublicUrl) {
          logError("CLASSIFY:2", "Missing pdfPublicUrl - upload route did not persist public URL");
          throw new Error("Missing pdfPublicUrl: ensure upload completed and persisted the public URL before classification");
        }
        logSuccess("CLASSIFY:2", `Using uploaded PDF at ${pdfPublicUrl}`);
        emit(controller, {
          type: "progress",
          phase: "classify",
          message: "Found uploaded PDF URL, starting classification",
          pdfPublicUrl,
        });

        emit(controller, {
          type: "progress",
          message: "Analyzing full PDF with Mistral Document AI...",
          phase: "classify",
        });

        // STEP 3: Direct Mistral classification on full PDF
        logStep("CLASSIFY:3", "Calling Mistral /v1/ocr with classifier schema...");

        const { pages: detectedPages, state: documentState } = await callMistralClassify(
          pdfPublicUrl,
          pageCount
        );

        logSuccess("CLASSIFY:3", `Received classification for ${detectedPages.length} pages`);

        // STEP 4: Run universal post-processor (exact same logic as before)
        logStep("CLASSIFY:4", "Running post-processor to determine critical pages...");

        const criticalPageNumbers = getCriticalPageNumbers(detectedPages as any);
        const pageLabelsMap = buildUniversalPageLabels(detectedPages as any, criticalPageNumbers);
        const packageMetadata = extractPackageMetadata(detectedPages as any, criticalPageNumbers);

        const pageLabels: Record<number, string> = {};
        pageLabelsMap.forEach((label, page) => {
          pageLabels[page] = label;
        });

        const classificationMetadata = {
          criticalPageNumbers,
          pageLabels,
          packageMetadata,
          state: documentState,
        };

        // Save everything needed for extraction phase
        await db.parse.update({
          where: { id: parseId },
          data: {
            classificationCache: classificationMetadata,
            criticalPageNumbers,
            status: "CLASSIFIED",
          },
        });

        const metadataSizeKB = JSON.stringify(classificationMetadata).length / 1024;
        logSuccess("CLASSIFY:4", `Post-processor complete – ${criticalPageNumbers.length} critical pages (${metadataSizeKB.toFixed(1)} KB saved)`);

        // Final success event – identical shape to previous classify route
        emit(controller, {
          type: "complete",
          criticalPageCount: criticalPageNumbers.length,
          detectedForms: packageMetadata.detectedFormCodes,
          state: documentState ?? null,
        });

        logSuccess("CLASSIFY:DONE", "Classification pipeline complete");

        controller.close();
      } catch (error: any) {
        logError("CLASSIFY:ERROR", error.message);
        console.error("[Classify Route] Full error:", error);

        emit(controller, {
          type: "error",
          message: error.message || "Classification failed",
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