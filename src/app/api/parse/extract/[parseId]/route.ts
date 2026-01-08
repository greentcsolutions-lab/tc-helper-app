// src/app/api/parse/extract/[parseId]/route.ts
// Version: 7.0.0 - 2026-01-08
// GEMINI 3 FLASH PREVIEW: Full-document extraction in ONE call
// Built-in reasoning negates post-processing, batching, and role detection
// Handles up to 100 pages with counter/addenda override logic built-in

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { mapExtractionToParseResult } from "@/lib/parse/map-to-parse-result";
import { extractWithGemini } from "@/lib/extraction/gemini/extractPdf";
import { logStep, logSuccess, logError } from "@/lib/debug/parse-logger";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ parseId: string }> }
) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return new Response("Unauthorized", { status: 401 });

  const { parseId } = await params;

  console.log(`[extract] START parseId=${parseId}`);

  try {
    logStep("EXTRACT:1", "Loading parse record...");

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

    if (!parse) {
      return Response.json({ error: "Parse not found" }, { status: 404 });
    }

    if (parse.user.clerkId !== clerkUserId) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (!parse.pdfPublicUrl) {
      return Response.json({ error: "Missing PDF URL" }, { status: 400 });
    }

    if (!parse.pageCount) {
      return Response.json({ error: "Missing page count – upload failed" }, { status: 400 });
    }

    console.log(`[extract] Document: ${parse.pageCount} pages`);
    logSuccess("EXTRACT:1", `Loaded ${parse.pageCount}-page document`);

    logStep("EXTRACT:2", "Extracting with Gemini 3 Flash Preview (full document in ONE call)...");

    // Extract entire document with Gemini - built-in reasoning handles merging
    const extractionResult = await extractWithGemini(
      parse.pdfPublicUrl,
      parse.pageCount
    );

    console.log(
      `[extract] Gemini extraction complete - confidence: ${extractionResult.finalTerms.confidence?.overall_confidence || 'N/A'}%`
    );

    logSuccess("EXTRACT:2", `Extraction complete – processed ${parse.pageCount} pages`);

    logStep("EXTRACT:3", "Mapping to Parse fields...");

    const mappedFields = mapExtractionToParseResult({
      universal: extractionResult.finalTerms,
      route: "gemini-3-flash-preview",
      details: {
        criticalPages: extractionResult.criticalPages,
        allExtractions: extractionResult.allExtractions,
      },
      timelineEvents: [],
    });

    const finalStatus = extractionResult.needsReview ? "NEEDS_REVIEW" : "COMPLETED";

    const extractionDetailsJson = mappedFields.extractionDetails
      ? JSON.parse(JSON.stringify(mappedFields.extractionDetails))
      : undefined;

    await db.$transaction(async (tx) => {
      await tx.parse.update({
        where: { id: parseId },
        data: {
          status: finalStatus,
          ...mappedFields,
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

      const parseRecord = await tx.parse.findUnique({
        where: { id: parseId },
        select: { userId: true },
      });

      if (parseRecord) {
        await tx.userUsage.upsert({
          where: { userId: parseRecord.userId },
          create: { userId: parseRecord.userId, parses: 1, lastParse: new Date() },
          update: { parses: { increment: 1 }, lastParse: new Date() },
        });
      }
    });

    logSuccess("EXTRACT:3", `Saved – status: ${finalStatus}`);
    logSuccess("EXTRACT:DONE", "Gemini 3 Flash Preview extraction complete");

    return Response.json({
      success: true,
      needsReview: extractionResult.needsReview,
      confidence: extractionResult.finalTerms.confidence?.overall_confidence || null,
      totalPages: parse.pageCount,
    });
  } catch (error: any) {
    logError("EXTRACT:ERROR", error.message);
    console.error("[Extract Route] Full error:", error);

    return Response.json(
      { error: error.message || "Extraction failed" },
      { status: 500 }
    );
  }
}