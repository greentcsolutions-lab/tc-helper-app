// src/app/api/parse/extract/[parseId]/route.ts
// Version: 5.2.0 - 2026-01-07
// UPDATED: Parallel batched extraction via extractFromCriticalPages
// Chunks run concurrently with Promise.all() for speed
// Full classificationMetadata passed for provenance

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { mapExtractionToParseResult } from "@/lib/parse/map-to-parse-result";
import { extractFromCriticalPages } from "@/lib/extraction/mistral/extractPdf";
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
    logStep("EXTRACT:1", "Loading parse + classification metadata...");

    const parse = await db.parse.findUnique({
      where: { id: parseId },
      select: {
        id: true,
        userId: true,
        status: true,
        pdfPublicUrl: true,
        classificationCache: true,
        user: { select: { clerkId: true } },
      },
    });

    if (!parse) {
      return Response.json({ error: "Parse not found" }, { status: 404 });
    }

    if (parse.user.clerkId !== clerkUserId) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (parse.status !== "CLASSIFIED") {
      return Response.json({ error: `Invalid status: ${parse.status}` }, { status: 400 });
    }

    if (!parse.pdfPublicUrl) {
      return Response.json({ error: "Missing PDF URL – re-run classification" }, { status: 400 });
    }

    if (!parse.classificationCache) {
      return Response.json({ error: "Classification cache missing" }, { status: 400 });
    }

    const classificationMetadata = parse.classificationCache as {
      criticalPageNumbers: number[];
      pageLabels: Record<number, string>;
      packageMetadata: any;
      state: string | null;
    };

    const criticalPages = classificationMetadata.criticalPageNumbers;

    console.log(
      `[extract] Critical pages: ${criticalPages.length} [${criticalPages.join(", ")}]`
    );
    logSuccess("EXTRACT:1", `Loaded ${criticalPages.length} critical pages`);

    logStep("EXTRACT:2", "Starting parallel batched Mistral extraction (≤8 pages per call)...");

    // Parallel extraction – chunks run concurrently
    const mergeResult = await extractFromCriticalPages(
      parse.pdfPublicUrl,
      classificationMetadata
    );

    logSuccess("EXTRACT:2", `Parallel extraction complete – needsReview: ${mergeResult.needsReview}`);

    logStep("EXTRACT:3", "Mapping to Parse fields...");

    const mappedFields = mapExtractionToParseResult({
      universal: mergeResult.finalTerms,
      route: "mistral-parallel-batched-pdf",
      details: {
        provenance: mergeResult.provenance,
        pageExtractions: mergeResult.pageExtractions,
      },
      timelineEvents: [],
    });

    const finalStatus = mergeResult.needsReview ? "NEEDS_REVIEW" : "COMPLETED";

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
    logSuccess("EXTRACT:DONE", "Parallel batched extraction pipeline complete");

    return Response.json({
      success: true,
      needsReview: mergeResult.needsReview,
      criticalPageCount: criticalPages.length,
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