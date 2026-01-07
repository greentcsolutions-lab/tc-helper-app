// src/app/api/parse/classify/[parseId]/route.ts
// Version: 3.1.0 - 2026-01-07
// DIRECT-TO-MISTRAL CLASSIFY (no flattening, no pdf-lib, no pageCount derivation)
// - Mistral now returns pageCount in structured output (schema updated)
// - Removed ALL server-side PDF parsing attempts (pdf-lib + pdfjs + text heuristics)
// - pageCount comes directly from Mistral response
// - Everything else unchanged: credit deduction, post-processor, DB writes, SSE events

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
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
            fileName: true,
            user: { select: { clerkId: true, credits: true } },
            pdfPublicUrl: true,
          },
        });

        if (!parse) {
          throw new Error("Parse not found");
        }

        if (parse.user.clerkId !== clerkUserId) {
          throw new Error("Unauthorized");
        }

        // Deduct credit – classification is the paid step
        if (parse.user.credits < 1) {
          throw new Error("Insufficient credits");
        }

        await db.user.update({
          where: { clerkId: clerkUserId },
          data: { credits: { decrement: 1 } },
        });

        logSuccess("CLASSIFY:1", `Credit deducted – processing ${parse.fileName}`);

        // Verify we have the public URL from upload
        const pdfPublicUrl = parse.pdfPublicUrl;
        if (!pdfPublicUrl) {
          throw new Error("Missing pdfPublicUrl: upload must persist public URL");
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

        // Direct Mistral classification – now returns pageCount
        logStep("CLASSIFY:3", "Calling Mistral /v1/ocr with updated classifier schema...");

        const mistralResponse = await callMistralClassify(pdfPublicUrl);

        const {
          pages: detectedPages,
          state: documentState,
          pageCount: detectedPageCount,
        } = mistralResponse;

        if (detectedPages.length !== detectedPageCount) {
          logError("CLASSIFY:3", `Page count mismatch: Mistral reported ${detectedPageCount} pages but returned ${detectedPages.length} entries`);
          throw new Error("Classification response invalid: pageCount mismatch");
        }

        logSuccess("CLASSIFY:3", `Received classification for ${detectedPageCount} pages`);

        // Universal post-processor (unchanged)
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

        // Persist everything needed for extraction phase
        await db.parse.update({
          where: { id: parseId },
          data: {
            classificationCache: classificationMetadata,
            criticalPageNumbers,
            status: "CLASSIFIED",
            pageCount: detectedPageCount,
          },
        });

        const metadataSizeKB = JSON.stringify(classificationMetadata).length / 1024;
        logSuccess("CLASSIFY:4", `Post-processor complete – ${criticalPageNumbers.length} critical pages (${metadataSizeKB.toFixed(1)} KB saved)`);

        // Final success event (identical to previous)
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