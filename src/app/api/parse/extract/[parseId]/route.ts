// src/app/api/parse/extract/[parseId]/route.ts
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { mapExtractionToParseResult } from "@/lib/parse/map-to-parse-result";
import * as ParseLogger from "@/lib/debug/parse-logger";

// LLM Processes - NEW: Unified AI racing system
import { extractWithFastestAI } from "@/lib/extraction/shared/ai-race";

const { logStep, logSuccess, logError, logWarn } = ParseLogger;

export const runtime = "nodejs";
export const maxDuration = 300;

function emit(controller: ReadableStreamDefaultController, data: any) {
  controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ parseId: string }> }
) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return new Response("Unauthorized", { status: 401 });

  const { parseId } = await params;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        console.log(`[extract] START parseId=${parseId} at ${new Date().toISOString()}`);

        // 1. Load parse record
        logStep("EXTRACT:1", "Loading parse record...");
        emit(controller, {
          type: "progress",
          phase: "loading",
          message: "Got your document",
        });

        const parse = await db.parse.findUnique({
          where: { id: parseId },
          select: {
            id: true,
            userId: true,
            status: true,
            pdfPublicUrl: true,
            pageCount: true,
            user: { select: { clerkId: true } },
          },
        });

        if (!parse) throw new Error("Parse not found");
        if (parse.user.clerkId !== clerkUserId) throw new Error("Unauthorized");
        if (!parse.pdfPublicUrl) throw new Error("Missing PDF URL");
        if (!parse.pageCount) throw new Error("Missing page count");

        console.log(`[extract] Document: ${parse.pageCount} pages`);
        logSuccess("EXTRACT:1", `Loaded ${parse.pageCount}-page document`);

        // 2. LLM Extraction Logic (Unified AI Racing System)
        logStep("EXTRACT:2", "Racing all available AI providers...");
        emit(controller, {
          type: "progress",
          phase: "extract",
          message: "Handing your doc to the AI",
        });

        // Send AI processing message
        emit(controller, {
          type: "progress",
          phase: "extract",
          message: "Reading through your contract",
        });

        const extractionResult = await extractWithFastestAI(
          parse.pdfPublicUrl,
          parse.pageCount,
          (progressMessage: string) => {
            // Callback for AI race progress
            emit(controller, {
              type: "progress",
              phase: "extract",
              message: progressMessage,
            });
          }
        );

        if (!extractionResult) {
          throw new Error("No AI providers available for extraction");
        }

        const modelUsed = extractionResult.modelUsed;
        console.log(`[extract] Extraction complete via ${modelUsed}`);

        logStep("EXTRACT:3", "Mapping to Parse fields...");
        emit(controller, {
          type: "progress",
          phase: "processing",
          message: "Organizing the details",
        });

        const mappedFields = mapExtractionToParseResult({
          universal: extractionResult.finalTerms,
          route: modelUsed,
          details: {
            criticalPages: extractionResult.criticalPages,
            allExtractions: extractionResult.allExtractions,
          },
          timelineEvents: [],
        });

        const finalStatus = extractionResult.needsReview ? "NEEDS_REVIEW" : "COMPLETED";

        // Safety check for complex JSON fields
        const extractionDetailsJson = mappedFields.extractionDetails
          ? JSON.parse(JSON.stringify(mappedFields.extractionDetails))
          : undefined;

        // 4. Database Transaction
        emit(controller, {
          type: "progress",
          phase: "saving",
          message: "Saving your information",
        });

        await db.$transaction(async (tx) => {
          await tx.parse.update({
            where: { id: parseId },
            data: {
              status: finalStatus,
              ...mappedFields,
              // Explicitly handle nulls for Prisma
              earnestMoneyDeposit: mappedFields.earnestMoneyDeposit ?? undefined,
              financing: mappedFields.financing ?? undefined,
              contingencies: mappedFields.contingencies ?? undefined,
              closingCosts: mappedFields.closingCosts ?? undefined,
              brokers: mappedFields.brokers ?? undefined,
              extractionDetails: extractionDetailsJson,
              timelineEvents: mappedFields.timelineEvents ?? undefined,
              finalizedAt: new Date(),
              personalPropertyIncluded: mappedFields.personalPropertyIncluded ?? undefined,
            },
          });

          await tx.userUsage.upsert({
            where: { userId: parse.userId },
            create: { userId: parse.userId, parses: 1, lastParse: new Date() },
            update: { parses: { increment: 1 }, lastParse: new Date() },
          });
        });

        logSuccess("EXTRACT:DONE", `Extraction complete via ${modelUsed}`);

        emit(controller, {
          type: "complete",
          message: "All set!",
          needsReview: extractionResult.needsReview ?? false,
          confidence: extractionResult.finalTerms?.confidence?.overall_confidence ?? null,
          totalPages: parse.pageCount,
          modelUsed,
        });

        controller.close();
      } catch (error: any) {
        logError("EXTRACT:ERROR", error.message);
        console.error("[Extract Route] Full error:", error);

        emit(controller, {
          type: "error",
          message: error.message || "Extraction failed",
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
