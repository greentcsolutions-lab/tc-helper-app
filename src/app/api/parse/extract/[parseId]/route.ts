// src/app/api/parse/extract/[parseId]/route.ts
// Version: 4.0.0 - 2025-12-30
// BREAKING CHANGE: Uses single 200 DPI ZIP (renderZipUrl) instead of highResZipUrl
// OPTIMIZED: Extraction now uses same 200 DPI images as classification

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
        renderZipUrl: true,  // CHANGED: Now using universal renderZipUrl
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

    if (!parse.renderZipUrl) {  // CHANGED: Check renderZipUrl instead of highResZipUrl
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

    console.log(`\n${"=".repeat(80)}`);
    console.log(`[extract] 🔍 DIAGNOSTIC: Classification loaded from database`);
    console.log(`${"=".repeat(80)}`);
    console.log(`[extract] 🔍 criticalPageNumbers: [${classificationMetadata.criticalPageNumbers?.join(', ') || 'EMPTY'}]`);
    console.log(`[extract] 🔍 pageLabels keys: [${Object.keys(classificationMetadata.pageLabels || {}).join(', ')}]`);
    console.log(`[extract] 🔍 detectedFormCodes: [${classificationMetadata.packageMetadata?.detectedFormCodes?.join(', ') || 'NONE'}]`);
    console.log(`${"=".repeat(80)}\n`);

    console.log(`[extract] LOADED: ${classificationMetadata.criticalPageNumbers.length} pages [${classificationMetadata.criticalPageNumbers.join(',')}] forms=[${classificationMetadata.packageMetadata.detectedFormCodes.join(',')}]`);
    logSuccess("EXTRACT:1", `Loaded ${classificationMetadata.criticalPageNumbers.length} critical pages`);

    logStep("EXTRACT:2", "Downloading 200 DPI pages...");
    
    console.log(`\n${"=".repeat(80)}`);
    console.log(`[extract] 🔍 DIAGNOSTIC: About to extract pages from ZIP`);
    console.log(`${"=".repeat(80)}`);
    console.log(`[extract] 🔍 renderZipUrl: ${parse.renderZipUrl}`);  // CHANGED: Log renderZipUrl
    console.log(`[extract] 🔍 Requesting these page numbers: [${classificationMetadata.criticalPageNumbers.join(', ')}]`);
    console.log(`[extract] 🔍 Number of pages to extract: ${classificationMetadata.criticalPageNumbers.length}`);
    console.log(`${"=".repeat(80)}\n`);
    
    const criticalPages = await extractSpecificPagesFromZip(
      parse.renderZipUrl,  // CHANGED: Use universal renderZipUrl
      classificationMetadata.criticalPageNumbers
    );

    console.log(`\n${"=".repeat(80)}`);
    console.log(`[extract] 🔍 DIAGNOSTIC: Pages extracted from ZIP`);
    console.log(`${"=".repeat(80)}`);
    console.log(`[extract] 🔍 Received ${criticalPages.length} pages from extractSpecificPagesFromZip`);
    console.log(`[extract] 🔍 Extracted page numbers: [${criticalPages.map(p => p.pageNumber).join(', ')}]`);
    console.log(`[extract] 🔍 Expected page numbers: [${classificationMetadata.criticalPageNumbers.join(', ')}]`);
    console.log(`[extract] 🔍 Match: ${criticalPages.length === classificationMetadata.criticalPageNumbers.length ? '✅ YES' : '❌ NO'}`);
    console.log(`${"=".repeat(80)}\n`);

    const criticalImages = criticalPages.map(page => ({
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

    logSuccess("EXTRACT:2", `Downloaded ${criticalImages.length} pages at 200 DPI`);

    logStep("EXTRACT:3", "Running extractor...");
    
    console.log(`\n${"=".repeat(80)}`);
    console.log(`[extract] 🔍 DIAGNOSTIC: About to send to extractor`);
    console.log(`${"=".repeat(80)}`);
    console.log(`[extract] 🔍 criticalImages count: ${criticalImages.length}`);
    console.log(`[extract] 🔍 criticalImages page numbers: [${criticalImages.map(i => i.pageNumber).join(', ')}]`);
    console.log(`[extract] 🔍 Sample labels:`);
    criticalImages.slice(0, 3).forEach(img => {
      console.log(`[extract] 🔍   Page ${img.pageNumber}: "${img.label}"`);
    });
    console.log(`${"=".repeat(80)}\n`);
    
    const { universal, details, timelineEvents, needsReview, route: extractionRoute } = 
      await route({
        criticalImages,
        packageMetadata: classificationMetadata.packageMetadata,
        highDpiPages: criticalPages,  // Now 200 DPI instead of 300 DPI
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
        extractionDetails: extractionDetailsJson,
        timelineEvents: timelineEvents ?? undefined,
      },
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