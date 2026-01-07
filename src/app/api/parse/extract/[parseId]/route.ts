// src/app/api/parse/extract/[parseId]/route.ts
// Version: 5.0.1 - 2026-01-07
// FIXED: Wrap details properly for mapExtractionToParseResult (add provenance + pageExtractions)
// FIXED: Ensure personalPropertyIncluded is array or undefined (not null) for Prisma update

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { mistralExtractorSchema } from "@/lib/extraction/mistral/schema";
import { mapExtractionToParseResult } from "@/lib/parse/map-to-parse-result";
import { logStep, logSuccess, logError } from "@/lib/debug/parse-logger";

const MISTRAL_API_URL = "https://api.mistral.ai/v1/ocr";
const API_KEY = process.env.MISTRAL_API_KEY;

if (!API_KEY) {
  throw new Error("MISTRAL_API_KEY required");
}

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
    const pageLabels = classificationMetadata.pageLabels;

    console.log(
      `[extract] Critical pages: ${criticalPages.length} [${criticalPages.join(", ")}]`
    );
    logSuccess("EXTRACT:1", `Loaded ${criticalPages.length} critical pages`);

    logStep("EXTRACT:2", "Building focused prompt for Mistral...");

    // Build human-readable page list for the prompt
    const pageList = criticalPages
      .map((num) => {
        const label = pageLabels[num] || `Page ${num}`;
        return `Page ${num}: ${label}`;
      })
      .join("\n");

    const systemPrompt = `You are an expert real estate transaction extractor. 
Extract ALL transaction terms EXCLUSIVELY from the following critical pages only — ignore all other pages completely:

${pageList}

Focus only on filled/substantive content on these pages. 
Do not hallucinate data from boilerplate, disclosures, or non-critical pages.
Return structured JSON exactly matching the provided schema for each of these pages individually.`;

    logStep("EXTRACT:3", "Calling Mistral Document AI for targeted extraction...");

    const payload = {
      model: "mistral-ocr-latest",
      document: {
        type: "document_url",
        document_url: parse.pdfPublicUrl,
      },
      system_prompt: systemPrompt,
      document_annotation_format: {
        type: "json_schema",
        json_schema: mistralExtractorSchema,
      },
    };

    const response = await fetch(MISTRAL_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Mistral extraction failed ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    // Handle document_annotation same as before (string or object)
    let annotationObj: any;
    if (typeof data.document_annotation === "string") {
      annotationObj = JSON.parse(data.document_annotation);
    } else {
      annotationObj = data.document_annotation;
    }

    if (!annotationObj?.extractions || !Array.isArray(annotationObj.extractions)) {
      throw new Error("Invalid extraction response: missing extractions array");
    }

    const perPageExtractions = annotationObj.extractions;

    logSuccess("EXTRACT:3", `Received ${perPageExtractions.length} page extractions`);

    // Run our existing universal post-processor merge (unchanged)
    logStep("EXTRACT:4", "Merging page extractions...");

    // We import the merge function directly – it expects per-page format with confidence/sources
    const { mergePageExtractions } = await import("@/lib/extraction/extract/universal/post-processor");

    const mergeResult = await mergePageExtractions(perPageExtractions, classificationMetadata);

    logSuccess("EXTRACT:4", `Merge complete – needsReview: ${mergeResult.needsReview}`);

    // Map to DB fields exactly as before
    logStep("EXTRACT:5", "Mapping to Parse fields...");

    const mappedFields = mapExtractionToParseResult({
      universal: mergeResult.finalTerms,
      route: "mistral-direct-pdf",
      details: {
        provenance: mergeResult.provenance,
        pageExtractions: mergeResult.pageExtractions,
      },
      timelineEvents: [], // can be added later if needed
    });

    const finalStatus = mergeResult.needsReview ? "NEEDS_REVIEW" : "COMPLETED";

    const extractionDetailsJson = mappedFields.extractionDetails
      ? JSON.parse(JSON.stringify(mappedFields.extractionDetails))
      : undefined;

    // Transactional save + usage increment
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
          personalPropertyIncluded: mappedFields.personalPropertyIncluded ?? undefined,  // Ensure undefined, not null
        },
      });

      // Increment usage counter
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

    logSuccess("EXTRACT:5", `Saved – status: ${finalStatus}`);
    logSuccess("EXTRACT:DONE", "Direct-PDF extraction complete");

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