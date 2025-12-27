// src/app/api/parse/extract/[parseId]/route.ts
// Version: 2.0.0 - 2025-12-27
// Extracts transaction data via router, NO base64 in request body (reads from cache + DB)

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { route } from "@/lib/extraction/router";
import { mapExtractionToParseResult } from "@/lib/parse/map-to-parse-result";
import { getClassification, deleteClassification } from "@/lib/cache/classification-cache";
import { downloadAndExtractZip } from "@/lib/pdf/renderer";
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

  console.log(`\n${"═".repeat(80)}`);
  console.log(`║ 🤖 EXTRACT ROUTE STARTED`);
  console.log(`║ ParseID: ${parseId}`);
  console.log(`║ User: ${clerkUserId}`);
  console.log(`${"═".repeat(80)}\n`);

  try {
    // STEP 1: VALIDATE PARSE OWNERSHIP & FETCH DB DATA
    logStep("EXTRACT:1", "🔍 Validating parse and fetching ZIP URLs...");

    const parse = await db.parse.findUnique({
      where: { id: parseId },
      select: {
        id: true,
        userId: true,
        status: true,
        highResZipUrl: true,
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
      return Response.json({ error: "High-res rendering not complete" }, { status: 400 });
    }

    logSuccess("EXTRACT:1", "Parse validated, high-res ZIP URL found");

    // STEP 2: GET CLASSIFICATION FROM CACHE
    logStep("EXTRACT:2", "📦 Loading classification results from cache...");

    const classification = getClassification(parseId);

    if (!classification) {
      logError("EXTRACT:2", "Classification not found in cache (expired or missing)");
      return Response.json({ 
        error: "Classification not found. Please re-run classification." 
      }, { status: 404 });
    }

    logDataShape("EXTRACT:2 Classification Cache", classification);
    logSuccess("EXTRACT:2", `Loaded ${classification.criticalImages.length} critical images from cache`);

    // STEP 3: DOWNLOAD HIGH-DPI ZIP
    logStep("EXTRACT:3", "📥 Downloading high-DPI ZIP from Blob storage...");

    const highDpiPages = await downloadAndExtractZip(parse.highResZipUrl);

    logSuccess("EXTRACT:3", `Downloaded ${highDpiPages.length} high-DPI pages`);

    // STEP 4: ROUTE TO APPROPRIATE EXTRACTOR
    logStep("EXTRACT:4", "🧠 Routing to appropriate extractor...");

    const {
      universal,
      details,
      timelineEvents,
      needsReview,
      route: extractionRoute,
    } = await route({
      criticalImages: classification.criticalImages,
      packageMetadata: classification.packageMetadata,
      highDpiPages,
    });

    logDataShape("EXTRACT:4 Extraction Result", {
      universal,
      needsReview,
      route: extractionRoute,
      detailsPresent: !!details,
      timelineEventsCount: timelineEvents?.length || 0,
    });

    logSuccess("EXTRACT:4", `Extraction complete via ${extractionRoute} route — needsReview: ${needsReview}`);

    // STEP 5: DELETE CLASSIFICATION FROM CACHE
    logStep("EXTRACT:5", "🗑️ Deleting classification from cache...");
    
    deleteClassification(parseId);
    
    logSuccess("EXTRACT:5", "Cache cleared");

    // STEP 6: MAP TO DB FIELDS
    logStep("EXTRACT:6", "🗺️ Mapping extraction to DB fields...");

    const mappedFields = mapExtractionToParseResult({
      universal,
      route: extractionRoute,
      details: details || undefined,
      timelineEvents,
    });

    logDataShape("EXTRACT:6 Mapped Fields", mappedFields);

    // STEP 7: SAVE TO DATABASE
    logStep("EXTRACT:7", "💾 Saving final results to database...");

    const finalStatus = needsReview ? "NEEDS_REVIEW" : "COMPLETED";

    // Prepare nested JSON fields for Prisma (handle null properly)
    const dbUpdateData = {
      status: finalStatus,
      ...mappedFields,
      // Wrap JSON nulls for Prisma
      earnestMoneyDeposit: mappedFields.earnestMoneyDeposit ?? undefined,
      financing: mappedFields.financing ?? undefined,
      contingencies: mappedFields.contingencies ?? undefined,
      closingCosts: mappedFields.closingCosts ?? undefined,
      brokers: mappedFields.brokers ?? undefined,
      personalPropertyIncluded: mappedFields.personalPropertyIncluded ?? undefined,
      extractionDetails: mappedFields.extractionDetails ?? undefined,
      timelineEvents: mappedFields.timelineEvents ?? undefined,
      rawJson: {
        _extraction_route: extractionRoute,
        _classifier_metadata: classification.packageMetadata,
        _critical_page_count: classification.criticalImages.length,
      },
      finalizedAt: new Date(),
    };

    logDataShape("EXTRACT:7 DB Update", dbUpdateData);

    await db.parse.update({
      where: { id: parseId },
      data: dbUpdateData,
    });

    logSuccess("EXTRACT:7", `Saved — Status: ${finalStatus}`);

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

    // Update DB with error status
    await db.parse.update({
      where: { id: parseId },
      data: {
        status: "EXTRACTION_FAILED",
        errorMessage: error.message || "Extraction failed",
      },
    }).catch((dbError) => {
      console.error(`[ERROR] Failed to update error status:`, dbError);
    });

    console.error(`${"═".repeat(80)}\n`);

    return Response.json(
      { error: error.message || "Extraction failed" },
      { status: 500 }
    );
  }
}