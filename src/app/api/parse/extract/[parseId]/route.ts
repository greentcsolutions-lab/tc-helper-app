// src/app/api/parse/extract/[parseId]/route.ts
// Version: 2.1.2-db-only-prisma-fix - 2025-12-27
// Fixed Prisma Json null assignment error

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { route } from "@/lib/extraction/router";
import { mapExtractionToParseResult } from "@/lib/parse/map-to-parse-result";
import { downloadAndExtractZip } from "@/lib/pdf/renderer";
import { logDataShape, logStep, logSuccess, logError } from "@/lib/debug/parse-logger";
import { Prisma } from "@prisma/client"; // <-- ADD THIS IMPORT

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
      return Response.json({ error: "High-res rendering not complete" }, { status: 400 });
    }

    if (!parse.classificationCache) {
      logError("EXTRACT:1", "Classification not found in database");
      return Response.json({ 
        error: "Classification not found. Please re-run classification." 
      }, { status: 404 });
    }

    logSuccess("EXTRACT:1", "Parse validated + classification loaded from DB");

    const classification = parse.classificationCache as {
      criticalImages: Array<{ pageNumber: number; base64: string; label: string }>;
      packageMetadata: any;
      criticalPageNumbers: number[];
      state: string;
    };

    logDataShape("EXTRACT:1 Classification from DB", classification);
    logSuccess("EXTRACT:1", `Loaded ${classification.criticalImages.length} critical images`);

    // STEP 2: DOWNLOAD HIGH-DPI ZIP
    logStep("EXTRACT:2", "📥 Downloading high-DPI ZIP from Blob storage...");

    const highDpiPages = await downloadAndExtractZip(parse.highResZipUrl);

    logSuccess("EXTRACT:2", `Downloaded ${highDpiPages.length} high-DPI pages`);

    // STEP 3: ROUTE TO APPROPRIATE EXTRACTOR
    logStep("EXTRACT:3", "🧠 Routing to appropriate extractor...");

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

    logDataShape("EXTRACT:3 Extraction Result", {
      universal,
      needsReview,
      route: extractionRoute,
      detailsPresent: !!details,
      timelineEventsCount: timelineEvents?.length || 0,
    });

    logSuccess("EXTRACT:3", `Extraction complete via ${extractionRoute} route — needsReview: ${needsReview}`);

    // STEP 4: CLEAR CLASSIFICATION FROM DB (temporary data)
    logStep("EXTRACT:4", "🗑️ Clearing classificationCache from database...");

    await db.parse.update({
      where: { id: parseId },
      data: {
        // FIX: Use Prisma.JsonNull to explicitly allow null for Json? fields
        classificationCache: Prisma.JsonNull,
      },
    });

    logSuccess("EXTRACT:4", "Temporary classification cleared");

    // STEP 5: MAP TO DB FIELDS
    logStep("EXTRACT:5", "🗺️ Mapping extraction to DB fields...");

    const mappedFields = mapExtractionToParseResult({
      universal,
      route: extractionRoute,
      details: details || undefined,
      timelineEvents,
    });

    logDataShape("EXTRACT:5 Mapped Fields", mappedFields);

    // STEP 6: SAVE FINAL RESULTS
    logStep("EXTRACT:6", "💾 Saving final results to database...");

    const finalStatus = needsReview ? "NEEDS_REVIEW" : "COMPLETED";

    const dbUpdateData = {
      status: finalStatus,
      ...mappedFields,
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

    logDataShape("EXTRACT:6 DB Update", dbUpdateData);

    await db.parse.update({
      where: { id: parseId },
      data: dbUpdateData,
    });

    logSuccess("EXTRACT:6", `Saved — Status: ${finalStatus}`);

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