// src/app/api/parse/extract/[parseId]/route.ts
// Version: 1.1.0 - 2025-12-27
// Extracts transaction data via router, saves final results to DB (pure REST, no SSE)

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { route } from "@/lib/extraction/router";
import { mapExtractionToParseResult } from "@/lib/parse/map-to-parse-result";
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
    // STEP 1: VALIDATE PARSE OWNERSHIP
    logStep("EXTRACT:1", "🔍 Validating parse ownership...");

    const parse = await db.parse.findUnique({
      where: { id: parseId },
      select: {
        id: true,
        userId: true,
        status: true,
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

    logSuccess("EXTRACT:1", "Parse validated");

    // STEP 2: PARSE REQUEST BODY
    logStep("EXTRACT:2", "📦 Parsing classification results from request body...");

    const body = await request.json();
    const { criticalImages, metadata, highDpiPages } = body;

    if (!criticalImages || !Array.isArray(criticalImages)) {
      logError("EXTRACT:2", "Missing or invalid criticalImages in request body");
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    if (!metadata || typeof metadata !== "object") {
      logError("EXTRACT:2", "Missing or invalid metadata in request body");
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    if (!highDpiPages || !Array.isArray(highDpiPages)) {
      logError("EXTRACT:2", "Missing or invalid highDpiPages in request body");
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    logDataShape("EXTRACT:2 Classification Input", { criticalImages, metadata, highDpiPages });
    logSuccess("EXTRACT:2", `Received ${criticalImages.length} critical images`);

    // STEP 3: ROUTE TO APPROPRIATE EXTRACTOR
    logStep("EXTRACT:3", "🧠 Routing to appropriate extractor based on detected forms...");

    const {
      universal,
      details,
      timelineEvents,
      needsReview,
      route: extractionRoute,
    } = await route({
      criticalImages,
      packageMetadata: metadata,
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

    // STEP 4: MAP TO DB FIELDS
    logStep("EXTRACT:4", "🗺️ Mapping extraction to DB fields...");

    const mappedFields = mapExtractionToParseResult({
      universal,
      route: extractionRoute,
      details: details || undefined,
      timelineEvents,
    });

    logDataShape("EXTRACT:4 Mapped Fields", mappedFields);

    // STEP 5: SAVE TO DATABASE
    logStep("EXTRACT:5", "💾 Saving final results to database...");

    const finalStatus = needsReview ? "NEEDS_REVIEW" : "COMPLETED";

    const dbUpdateData = {
      status: finalStatus,
      ...mappedFields,
      rawJson: {
        _extraction_route: extractionRoute,
        _classifier_metadata: metadata,
        _critical_page_count: criticalImages.length,
      },
      finalizedAt: new Date(),
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