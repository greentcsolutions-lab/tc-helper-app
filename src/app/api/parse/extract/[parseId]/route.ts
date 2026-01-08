// src/app/api/parse/extract/[parseId]/route.ts
// Version: 6.0.0 - 2026-01-08
// SIMPLIFIED: Extracts ALL pages in batches (no classification needed)
// Filters by data quality instead of classification labels
// Cheaper, faster, more reliable than classification-based approach

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { mapExtractionToParseResult } from "@/lib/parse/map-to-parse-result";
import { extractAllPages } from "@/lib/extraction/mistral/extractPdf";
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

    logStep("EXTRACT:2", "Extracting all pages in batches (≤8 pages per call, parallel)...");

    // Extract all pages - filtering happens based on data quality
    const extractionResult = await extractAllPages(
      parse.pdfPublicUrl,
      parse.pageCount
    );

    console.log(
      `[extract] Found ${extractionResult.criticalPages.length} pages with substantive data: [${extractionResult.criticalPages.join(", ")}]`
    );

    logSuccess("EXTRACT:2", `Extraction complete – ${extractionResult.criticalPages.length} substantive pages found`);

    logStep("EXTRACT:3", "Mapping to Parse fields...");

    const mappedFields = mapExtractionToParseResult({
      universal: extractionResult.finalTerms,
      route: "mistral-simplified-all-pages",
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
    logSuccess("EXTRACT:DONE", "Simplified extraction pipeline complete");

    return Response.json({
      success: true,
      needsReview: extractionResult.needsReview,
      substantivePageCount: extractionResult.criticalPages.length,
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