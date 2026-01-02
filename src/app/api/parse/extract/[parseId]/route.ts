// src/app/api/parse/extract/[parseId]/route.ts
// Version: 4.2.0 - 2025-12-31
// UPDATED: Now passes classification metadata to router for lean extraction

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { route } from "@/lib/extraction/router";
import { mapExtractionToParseResult } from "@/lib/parse/map-to-parse-result";
import { extractSpecificPagesFromZip } from "@/lib/pdf/renderer";
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
    logStep("EXTRACT:1", "Validating & loading classification...");

    const parse = await db.parse.findUnique({
      where: { id: parseId },
      select: {
        id: true,
        userId: true,
        status: true,
        renderZipUrl: true,
        classificationCache: true,
        user: { select: { clerkId: true } },
      },
    });

    if (!parse) {
      logError("EXTRACT:1", "Parse not found");
      return Response.json({ error: "Parse not found" }, { status: 404 });
    }

    if (parse.user.clerkId !== clerkUserId) {
      logError("EXTRACT:1", "Unauthorized");
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (parse.status !== "PROCESSING") {
      logError("EXTRACT:1", `Invalid status: ${parse.status}`);
      return Response.json({ error: `Invalid status: ${parse.status}` }, { status: 400 });
    }

    if (!parse.renderZipUrl) {
      logError("EXTRACT:1", "Missing render ZIP");
      return Response.json({ error: "Rendering not complete" }, { status: 400 });
    }

    if (!parse.classificationCache) {
      logError("EXTRACT:1", "Classification not found");
      return Response.json({ error: "Classification not found. Please re-run classification." }, { status: 404 });
    }

    const classificationMetadata = parse.classificationCache as {
      criticalPageNumbers: number[];
      pageLabels: Record<number, string>;
      packageMetadata: any;
      state: string;
    };

    console.log(`[extract] LOADED: ${classificationMetadata.criticalPageNumbers.length} pages [${classificationMetadata.criticalPageNumbers.join(',')}] forms=[${classificationMetadata.packageMetadata.detectedFormCodes.join(',')}]`);
    logSuccess("EXTRACT:1", `Loaded ${classificationMetadata.criticalPageNumbers.length} critical pages`);

    logStep("EXTRACT:2", "Downloading 200 DPI pages...");
    
    const criticalPages = await extractSpecificPagesFromZip(
      parse.renderZipUrl,
      classificationMetadata.criticalPageNumbers
    );

    const expectedPages = new Set(classificationMetadata.criticalPageNumbers);
    const receivedPages = new Set(criticalPages.map(p => p.pageNumber));
    const pagesMatch = expectedPages.size === receivedPages.size && 
                       [...expectedPages].every(p => receivedPages.has(p));

    console.log(`[extract] VERIFY: ${pagesMatch ? '✅' : '❌'} Pages match (expected ${expectedPages.size}, got ${receivedPages.size})`);
    
    if (!pagesMatch) {
      const missing = [...expectedPages].filter(p => !receivedPages.has(p));
      const unexpected = [...receivedPages].filter(p => !expectedPages.has(p));
      if (missing.length > 0) console.error(`[extract] Missing pages: [${missing.join(',')}]`);
      if (unexpected.length > 0) console.warn(`[extract] Unexpected pages: [${unexpected.join(',')}]`);
    }

    const criticalImages = criticalPages.map(page => ({
      pageNumber: page.pageNumber,
      base64: page.base64,
      label: classificationMetadata.pageLabels[page.pageNumber] || `Page ${page.pageNumber}`,
    }));

    logSuccess("EXTRACT:2", `Downloaded ${criticalImages.length} pages at 200 DPI`);

    logStep("EXTRACT:3", "Running extractor...");
    
    const { universal, details, timelineEvents, needsReview, route: extractionRoute } = 
      await route({
        criticalImages,
        packageMetadata: classificationMetadata.packageMetadata,
        highDpiPages: criticalPages,
        classificationMetadata,  // v4.2.0: Pass classification metadata for lean extraction
      });

    logSuccess("EXTRACT:3", `Extraction via ${extractionRoute} — needsReview: ${needsReview}`);

    logStep("EXTRACT:4", "Mapping to DB fields...");
    const mappedFields = mapExtractionToParseResult({
      universal,
      route: extractionRoute,
      details: details || undefined,
      timelineEvents,
    });

    logStep("EXTRACT:5", "Saving results...");
    const finalStatus = needsReview ? "NEEDS_REVIEW" : "COMPLETED";

    const extractionDetailsJson = mappedFields.extractionDetails 
      ? JSON.parse(JSON.stringify(mappedFields.extractionDetails))
      : undefined;

    // Update parse and increment UserUsage counter in a transaction
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
          timelineEvents: timelineEvents ?? undefined,
        },
      });

      // Increment UserUsage counter (active parses only)
      const parse = await tx.parse.findUnique({
        where: { id: parseId },
        select: { userId: true },
      });

      if (parse) {
        await tx.userUsage.upsert({
          where: { userId: parse.userId },
          create: {
            userId: parse.userId,
            parses: 1,
            lastParse: new Date(),
          },
          update: {
            parses: { increment: 1 },
            lastParse: new Date(),
          },
        });
        console.log(`[extract:${parseId}] Incremented user usage counter`);
      }
    });

    logSuccess("EXTRACT:5", `Saved — status: ${finalStatus}`);
    logSuccess("EXTRACT:DONE", `Extraction complete — ${criticalImages.length} pages processed`);

    return Response.json({
      success: true,
      needsReview,
      criticalPageCount: criticalImages.length,
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