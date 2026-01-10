// src/app/api/parse/classify/[parseId]/route.ts
// Version: 3.3.0 - 2026-01-08
// Basic OCR + Grok text classifier (REQUIRED - no fallback to heuristics)
// Handles 48–52 page packets in 1 Mistral call + 1 Grok call
// FIX: Throw error on Grok failure instead of falling back to heuristics

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { callMistralClassify } from "@/lib/extraction/mistral/classifyPdf";
import { classifyFromMarkdown } from "@/lib/extraction/classify/markdown-classifier";
import { callGrokTextClassify } from "@/lib/extraction/grok/textClassify";
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

        if (!parse) throw new Error("Parse not found");
        if (parse.user.clerkId !== clerkUserId) throw new Error("Unauthorized");

        if (parse.user.credits < 1) throw new Error("Insufficient credits");

        await db.user.update({
          where: { clerkId: clerkUserId },
          data: { credits: { decrement: 1 } },
        });

        logSuccess("CLASSIFY:1", `Credit deducted – processing ${parse.fileName}`);

        const pdfPublicUrl = parse.pdfPublicUrl;
        if (!pdfPublicUrl) throw new Error("Missing pdfPublicUrl");

        logSuccess("CLASSIFY:2", `Using uploaded PDF at ${pdfPublicUrl}`);
        emit(controller, {
          type: "progress",
          phase: "classify",
          message: "Found uploaded PDF URL, starting classification",
          pdfPublicUrl,
        });

        emit(controller, {
          type: "progress",
          message: "Running full-document OCR with Mistral Document AI...",
          phase: "classify",
        });

        logStep("CLASSIFY:3", "Calling Mistral /v1/ocr (basic OCR mode – per-page markdown)");

        const mistralResponse = await callMistralClassify(pdfPublicUrl);

        const { pages: ocrPages, pageCount: detectedPageCount } = mistralResponse;

        if (ocrPages.length !== detectedPageCount) {
          logError("CLASSIFY:3", `Page count mismatch: ${detectedPageCount} declared vs ${ocrPages.length} returned`);
          throw new Error("OCR response invalid: page count mismatch");
        }

        logSuccess("CLASSIFY:3", `Received OCR for ${detectedPageCount} pages`);

        logStep("CLASSIFY:4", "Running heuristic markdown classifier...");

        const detectedPages = classifyFromMarkdown(ocrPages);

        logSuccess("CLASSIFY:4", `Heuristic classification complete – ${detectedPages.length} pages labeled`);

        logStep("CLASSIFY:4.5", "Running Grok text classifier for page-level labels...");
        emit(controller, { type: "progress", phase: "classify", message: "Running page classifier (AI technology)..." });

        // Grok classification is REQUIRED - do not fall back to heuristics
        const grokResult = await callGrokTextClassify(
          ocrPages.map((p) => p.markdown),
          detectedPageCount
        );

        if (!grokResult.valid) {
          const errorMsg = `AI classifier failed: ${grokResult.errors?.join(", ") || "Unknown error"}`;
          logError("CLASSIFY:4.5", errorMsg);
          throw new Error(errorMsg);
        }

        if (!grokResult.classification || !Array.isArray(grokResult.classification.pages)) {
          logError("CLASSIFY:4.5", "AI classifier returned invalid structure");
          throw new Error("AI classifier returned invalid structure");
        }

        if (grokResult.classification.pageCount !== detectedPageCount) {
          const errorMsg = `AI classifier page count mismatch: expected ${detectedPageCount}, got ${grokResult.classification.pageCount}`;
          logError("CLASSIFY:4.5", errorMsg);
          throw new Error(errorMsg);
        }

        const llmClassification = grokResult.classification;

        logSuccess("CLASSIFY:4.5", `Grok classifier returned valid labels for ${detectedPageCount} pages`);
        emit(controller, {
          type: "progress",
          phase: "classify",
          message: "AI classifier returned valid labels, merging with heuristics",
        });

        // Merge: prefer LLM labels when present, otherwise fall back to heuristic
        const finalDetectedPages = detectedPages.map((heur, idx) => {
          const llmPage = llmClassification.pages[idx];
          if (!llmPage) return heur;

          return {
            ...heur,
            pdfPage: llmPage.pdfPage ?? idx + 1,
            formCode: llmPage.formCode ?? heur.formCode,
            formPage: llmPage.formPage ?? heur.formPage,
            totalPagesInForm: llmPage.totalPagesInForm ?? heur.totalPagesInForm,
            role: llmPage.role ?? heur.role,
            contentCategory: llmPage.contentCategory ?? heur.contentCategory,
            hasFilledFields:
              typeof llmPage.hasFilledFields === "boolean"
                ? llmPage.hasFilledFields
                : heur.hasFilledFields,
            confidence:
              typeof llmPage.confidence === "number"
                ? llmPage.confidence
                : heur.confidence,
            titleSnippet: llmPage.titleSnippet ?? heur.titleSnippet,
            footerText: heur?.footerText,
          };
        });

        const classificationSource: "heuristic" | "llm" | "combined" = "llm";

        logStep("CLASSIFY:5", "Running post-processor to determine critical pages...");

        const criticalPageNumbers = getCriticalPageNumbers(finalDetectedPages);
        const pageLabelsMap = buildUniversalPageLabels(finalDetectedPages, criticalPageNumbers);
        const packageMetadata = extractPackageMetadata(finalDetectedPages, criticalPageNumbers);

        const pageLabels: Record<number, string> = {};
        pageLabelsMap.forEach((label, page) => {
          pageLabels[page] = label;
        });

        const classificationMetadata = {
          criticalPageNumbers,
          pageLabels,
          packageMetadata,
          classificationSource: classificationSource ?? "heuristic",
          state: packageMetadata.detectedFormCodes.length > 0 ? "CA" : null, // simple fallback
        };

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
        logSuccess("CLASSIFY:5", `Post-processor complete – ${criticalPageNumbers.length} critical pages (${metadataSizeKB.toFixed(1)} KB saved)`);

        emit(controller, {
          type: "complete",
          criticalPageCount: criticalPageNumbers.length,
          detectedForms: packageMetadata.detectedFormCodes,
          state: classificationMetadata.state,
        });

        logSuccess("CLASSIFY:DONE", "Classification pipeline complete (basic OCR + heuristics)");

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