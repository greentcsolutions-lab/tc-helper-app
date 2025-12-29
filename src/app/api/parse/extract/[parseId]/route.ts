// src/app/api/parse/extract/[parseId]/route.ts
// Version: 3.0.0 - 2025-12-29
// BREAKING: Fixed Issues #1, #2, #4 - High-res only, field provenance, remove duplicate cache clear

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { route } from "@/lib/extraction/router";
import { mapExtractionToParseResult } from "@/lib/parse/map-to-parse-result";
import { extractSpecificPagesFromZip } from "@/lib/pdf/renderer";
import { logDataShape, logStep, logSuccess, logError } from "@/lib/debug/parse-logger";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ parseId: string }> }
) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return new Response("Unauthorized", { status: 401 });

  const { parseId } = await params;

  console.log(`\n${"═".repeat(80)}`);
  console.log(`║ 🤖 EXTRACT ROUTE STARTED`);
  console.log(`║ ParseID: ${parseId}`);
  console.log(`║ User: ${clerkUserId}`);
  console.log(`${"═".repeat(80)}\n`);

  try {
    // STEP 1: VALIDATE + FETCH CLASSIFICATION FROM DB
    logStep("EXTRACT:1", "🔍 Validating parse and loading classification from DB...");

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
      logError("EXTRACT:1", "Unauthorized access");
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (parse.status !== "PROCESSING") {
      logError("EXTRACT:1", `Invalid status: ${parse.status}`);
      return Response.json({ error: `Invalid status: ${parse.status}` }, { status: 400 });
    }

    if (!parse.highResZipUrl) {
      logError("EXTRACT:1", "Missing high-res ZIP URL");
      return Response.json({ error: "Rendering not complete" }, { status: 400 });
    }

    if (!parse.classificationCache) {
      logError("EXTRACT:1", "Classification not found in database");
      return Response.json({ 
        error: "Classification not found. Please re-run classification." 
      }, { status: 404 });
    }

    logSuccess("EXTRACT:1", "Parse validated + classification loaded from DB");

    const classificationMetadata = parse.classificationCache as {
      criticalPageNumbers: number[];
      pageLabels: Record<number, string>;
      packageMetadata: any;
      state: string;
    };

    logDataShape("EXTRACT:1 Classification Metadata", classificationMetadata);
    logSuccess("EXTRACT:1", `Metadata loaded: ${classificationMetadata.criticalPageNumbers.length} critical pages`);

    // STEP 2: RECONSTRUCT IMAGES FROM HIGH-RES ZIP ONLY (FIX #1)
    logStep("EXTRACT:2", "📥 Downloading high-res critical pages from ZIP...");

    // Download ONLY high-res critical pages (performance optimization)
    const highResCriticalPages = await extractSpecificPagesFromZip(
      parse.highResZipUrl,
      classificationMetadata.criticalPageNumbers
    );

    // Build labeled critical images using high-res + metadata labels
    const criticalImages = highResCriticalPages.map(page => ({
      pageNumber: page.pageNumber,
      base64: page.base64,
      label: classificationMetadata.pageLabels[page.pageNumber] || `Page ${page.pageNumber}`,
    }));

    logSuccess("EXTRACT:2", `Downloaded ${criticalImages.length} high-res critical pages (skipped low-res download)`);

    // STEP 3: ROUTE TO APPROPRIATE EXTRACTOR
    logStep("EXTRACT:3", "🧠 Routing to appropriate extractor...");

    const {
      universal,
      details,
      timelineEvents,
      needsReview,
      route: extractionRoute,
    } = await route({
      criticalImages,
      packageMetadata: classificationMetadata.packageMetadata,
      highDpiPages: highResCriticalPages,
    });

    logDataShape("EXTRACT:3 Extraction Result", {
      universal,
      needsReview,
      route: extractionRoute,
      detailsPresent: !!details,
      timelineEventsCount: timelineEvents?.length || 0,
    });

    logSuccess("EXTRACT:3", `Extraction complete via ${extractionRoute} route — needsReview: ${needsReview}`);

    // STEP 4: MAP TO DB FIELDS (with proper field provenance - FIX #2)
    logStep("EXTRACT:4", "🗺️ Mapping extraction to DB fields...");

    const mappedFields = mapExtractionToParseResult({
      universal,
      route: extractionRoute,
      details: details || undefined,
      timelineEvents,
    });

    logDataShape("EXTRACT:4 Mapped Fields", mappedFields);

    // STEP 5: SAVE FINAL RESULTS (removed duplicate classificationCache clear - FIX #4)
    logStep("EXTRACT:5", "💾 Saving final results to database...");

    const finalStatus = needsReview ? "NEEDS_REVIEW" : "COMPLETED";

    // Serialize extractionDetails to proper JSON (fix Prisma type error)
    const extractionDetailsJson = mappedFields.extractionDetails 
      ? JSON.parse(JSON.stringify(mappedFields.extractionDetails))
      : undefined;

    const dbUpdateData = {
      status: finalStatus,
      ...mappedFields,
      earnestMoneyDeposit: mappedFields.earnestMoneyDeposit ?? undefined,
      financing: mappedFields.financing ?? undefined,
      contingencies: mappedFields.contingencies ?? undefined,
      closingCosts: mappedFields.closingCosts ?? undefined,
      brokers: mappedFields.brokers ?? undefined,
      personalPropertyIncluded: mappedFields.personalPropertyIncluded ?? undefined,
      extractionDetails: extractionDetailsJson,  // Use serialized version
      timelineEvents: mappedFields.timelineEvents ?? undefined,
      rawJson: {
        _extraction_route: extractionRoute,
        _classifier_metadata: classificationMetadata.packageMetadata,
        _critical_page_count: criticalImages.length,
      },
      finalizedAt: new Date(),
      // REMOVED: classificationCache clear (FIX #4 - cleanup route handles this)
    };

    logDataShape("EXTRACT:5 DB Update", dbUpdateData);

    await db.parse.update({
      where: { id: parseId },
      data: dbUpdateData,
    });

    logSuccess("EXTRACT:5", `Saved — Status: ${finalStatus}`);

    console.log(`\n${"═".repeat(80)}`);
    console.log(`║ ✅ EXTRACT ROUTE COMPLETED`);
    console.log(`║ ParseID: ${parseId} | Status: ${finalStatus}`);
    console.log(`${"═".repeat(80)}\n`);

    return Response.json({
      success: true,
      needsReview,
      status: finalStatus,
      extracted: universal,
    });
  } catch (error: any) {
    console.error(`\n${"═".repeat(80)}`);
    console.error(`║ ❌ EXTRACT ROUTE FAILED`);
    console.error(`║ ParseID: ${parseId}`);
    console.error(`${"═".repeat(80)}`);
    console.error(`\n[ERROR] ${error.message}`);
    console.error(`[ERROR] Stack:`, error.stack);

    await db.parse.update({
      where: { id: parseId },
      data: {
        status: "EXTRACTION_FAILED",
        errorMessage: error.message || "Extraction failed",
      },
    }).catch((dbError) => {
      console.error(`[ERROR] Failed to update error status:`, dbError);
    });

    return Response.json(
      { error: error.message || "Extraction failed" },
      { status: 500 }
    );
  }
}