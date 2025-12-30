// src/app/api/parse/extract/[parseId]/route.ts
// Version: 3.1.1 - 2025-12-30
// OPTIMIZED: Minimal logging under 256 line limit

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { route } from "@/lib/extraction/router";
import { mapExtractionToParseResult } from "@/lib/parse/map-to-parse-result";
import { extractSpecificPagesFromZip } from "@/lib/pdf/renderer";
import { logDataShape, logStep, logSuccess, logError } from "@/lib/debug/parse-logger";

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
        highResZipUrl: true,
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

    if (!parse.highResZipUrl) {
      logError("EXTRACT:1", "Missing high-res ZIP");
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

    logStep("EXTRACT:2", "Downloading high-res pages...");
    const highResCriticalPages = await extractSpecificPagesFromZip(
      parse.highResZipUrl,
      classificationMetadata.criticalPageNumbers
    );

    const criticalImages = highResCriticalPages.map(page => ({
      pageNumber: page.pageNumber,
      base64: page.base64,
      label: classificationMetadata.pageLabels[page.pageNumber] || `Page ${page.pageNumber}`,
    }));

    // Verify reconstruction
    const expectedPages = new Set(classificationMetadata.criticalPageNumbers);
    const reconstructedPages = new Set(criticalImages.map(img => img.pageNumber));
    const missing = [...expectedPages].filter(p => !reconstructedPages.has(p));
    const unexpected = [...reconstructedPages].filter(p => !expectedPages.has(p));

    if (missing.length > 0) {
      console.error(`[extract] MISSING PAGES: [${missing.join(',')}]`);
    }
    if (unexpected.length > 0) {
      console.warn(`[extract] UNEXPECTED PAGES: [${unexpected.join(',')}]`);
    }
    if (missing.length === 0 && unexpected.length === 0) {
      console.log(`[extract] VERIFY OK: All ${criticalImages.length} pages matched`);
    }

    logSuccess("EXTRACT:2", `Downloaded ${criticalImages.length} high-res pages`);

    logStep("EXTRACT:3", "Running extractor...");
    const { universal, details, timelineEvents, needsReview, route: extractionRoute } = 
      await route({
        criticalImages,
        packageMetadata: classificationMetadata.packageMetadata,
        highDpiPages: highResCriticalPages,
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

    await db.parse.update({
      where: { id: parseId },
      data: {
        status: finalStatus,
        ...mappedFields,
        earnestMoneyDeposit: mappedFields.earnestMoneyDeposit ?? undefined,
        financing: mappedFields.financing ?? undefined,
        contingencies: mappedFields.contingencies ?? undefined,
        closingCosts: mappedFields.closingCosts ?? undefined,
        brokers: mappedFields.brokers ?? undefined,
        personalPropertyIncluded: mappedFields.personalPropertyIncluded ?? undefined,
        extractionDetails: extractionDetailsJson,
        timelineEvents: mappedFields.timelineEvents ?? undefined,
        rawJson: {
          _extraction_route: extractionRoute,
          _classifier_metadata: classificationMetadata.packageMetadata,
          _critical_page_count: criticalImages.length,
        },
        finalizedAt: new Date(),
      },
    });

    logSuccess("EXTRACT:5", `Saved — Status: ${finalStatus}`);
    console.log(`[extract] COMPLETE: ${finalStatus}`);

    return Response.json({
      success: true,
      needsReview,
      status: finalStatus,
      extracted: universal,
    });
  } catch (error: any) {
    console.error(`[extract] ERROR: ${error.message}`);
    await db.parse.update({
      where: { id: parseId },
      data: {
        status: "EXTRACTION_FAILED",
        errorMessage: error.message || "Extraction failed",
      },
    }).catch((dbError) => {
      console.error(`[extract] DB update failed:`, dbError);
    });

    return Response.json({ error: error.message || "Extraction failed" }, { status: 500 });
  }
}