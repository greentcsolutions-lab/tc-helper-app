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
          try {
            const { PDFDocument } = await import("pdf-lib");
            const pdfDoc = await PDFDocument.load(parse.pdfBuffer);
            pageCount = pdfDoc.getPageCount();
            await db.parse.update({ where: { id: parseId }, data: { pageCount } });
            logSuccess("CLASSIFY:1", `Derived pageCount=${pageCount} from PDF buffer`);
          } catch (err) {
            // Fallback: naive scan for "/Type /Page"
            try {
              const bufferStr = parse.pdfBuffer.toString("latin1");
              const matches = (bufferStr.match(/\/Type\s*\/Page\b/g) || []).length;
              if (matches > 0) {
                pageCount = matches;
                await db.parse.update({ where: { id: parseId }, data: { pageCount } });
                logSuccess("CLASSIFY:1", `Fallback derived pageCount=${pageCount} by scanning PDF`);
              }
            } catch (scanErr) {
              // ignore; we'll error below if pageCount still missing
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

        // STEP 2: Upload original PDF to temporary public Blob (short-lived, used for both classify & extract)
        logStep("CLASSIFY:2", "Uploading original PDF to temporary public Vercel Blob...");

        const { url: pdfPublicUrl } = await put(
          `temp-pdf/${parseId}-${Date.now()}.pdf`,
          parse.pdfBuffer,
          {
            access: "public",
            addRandomSuffix: true,
          }
        );

        // Persist the public URL for the upcoming extraction phase
        await db.parse.update({
          where: { id: parseId },
          data: { pdfPublicUrl },
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