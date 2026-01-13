// src/app/api/parse/extract/[parseId]/route.ts
// Version: 7.2.0 - 2026-01-13
// Enhanced logging around primary/fallback calls and timeouts
// Goal: Clearly see when primary starts, if/when it times out, when fallback starts, and if fallback succeeds/fails

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { mapExtractionToParseResult } from "@/lib/parse/map-to-parse-result";
import { extractWithGemini } from "@/lib/extraction/gemini/extractPdf";
import { logStep, logSuccess, logError, logWarn } from "@/lib/debug/parse-logger";

export const runtime = "nodejs";
export const maxDuration = 300; // still safe ceiling on Vercel Pro

// Helper to create a timeout promise
const timeoutPromise = (ms: number) =>
  new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Extraction timeout")), ms)
  );

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ parseId: string }> }
) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return new Response("Unauthorized", { status: 401 });

  const { parseId } = await params;
  console.log(`[extract] START parseId=${parseId} at ${new Date().toISOString()}`);

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

    if (!parse) return Response.json({ error: "Parse not found" }, { status: 404 });
    if (parse.user.clerkId !== clerkUserId) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }
    if (!parse.pdfPublicUrl) return Response.json({ error: "Missing PDF URL" }, { status: 400 });
    if (!parse.pageCount) return Response.json({ error: "Missing page count" }, { status: 400 });

    console.log(`[extract] Document: ${parse.pageCount} pages`);
    logSuccess("EXTRACT:1", `Loaded ${parse.pageCount}-page document`);

    logStep("EXTRACT:2", "Extracting with Gemini 3 Flash Preview (primary)...");

    // Primary + Fallback configuration
    let extractionResult;
    const PRIMARY_MODEL = "gemini-3-flash-preview";
    const FALLBACK_MODEL = "gemini-2.5-flash-lite";

    // ── Primary attempt ───────────────────────────────────────────────────────
    console.log(`[extract] Starting primary call to ${PRIMARY_MODEL} at ${new Date().toISOString()}`);
    try {
      extractionResult = await Promise.race([
        extractWithGemini(parse.pdfPublicUrl, parse.pageCount, PRIMARY_MODEL),
        timeoutPromise(60000), // 60 seconds
      ]);
      console.log(`[extract] Primary (${PRIMARY_MODEL}) SUCCESS at ${new Date().toISOString()}`);
    } catch (err: any) {
      const errorTime = new Date().toISOString();
      console.log(`[extract] Primary (${PRIMARY_MODEL}) FAILED at ${errorTime}: ${err.message}`);

      if (err.message.includes("timeout")) {
        logWarn(
          "EXTRACT:FALLBACK",
          `Primary Gemini 3 Flash Preview timed out after 60s → falling back to ${FALLBACK_MODEL}`
        );

        // ── Fallback attempt ──────────────────────────────────────────────────
        console.log(`[extract] Starting fallback call to ${FALLBACK_MODEL} at ${new Date().toISOString()}`);
        try {
          extractionResult = await extractWithGemini(
            parse.pdfPublicUrl,
            parse.pageCount,
            FALLBACK_MODEL
          );
          console.log(`[extract] Fallback (${FALLBACK_MODEL}) SUCCESS at ${new Date().toISOString()}`);
        } catch (fallbackErr: any) {
          console.log(
            `[extract] Fallback (${FALLBACK_MODEL}) also FAILED at ${new Date().toISOString()}: ${fallbackErr.message}`
          );
          throw fallbackErr; // Let outer catch handle final 500
        }
      } else {
        // Non-timeout error (auth, rate limit, etc.)
        throw err;
      }
    }

    // ── Result handling ───────────────────────────────────────────────────────
    console.log(
      `[extract] Extraction complete - confidence: ${
        extractionResult.finalTerms.confidence?.overall_confidence || "N/A"
      }% (from ${extractionResult.modelUsed || "unknown"})`
    );
    logSuccess("EXTRACT:2", `Extraction complete – processed ${parse.pageCount} pages`);

    logStep("EXTRACT:3", "Mapping to Parse fields...");
    const mappedFields = mapExtractionToParseResult({
      universal: extractionResult.finalTerms,
      route: extractionResult.modelUsed || "gemini-fallback",
      details: {
        criticalPages: extractionResult.criticalPages,
        allExtractions: extractionResult.allExtractions,
      },
      timelineEvents: [],
    });

    // Debug logging for timeline dates
    console.log('[extract] Timeline dates being saved:');
    console.log(' effectiveDate:', mappedFields.effectiveDate);
    console.log(' initialDepositDueDate:', mappedFields.initialDepositDueDate);
    console.log(' sellerDeliveryOfDisclosuresDate:', mappedFields.sellerDeliveryOfDisclosuresDate);
    console.log(' closingDate:', mappedFields.closingDate);

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
    logSuccess("EXTRACT:DONE", "Extraction complete (with possible fallback)");

    return Response.json({
      success: true,
      needsReview: extractionResult.needsReview,
      confidence: extractionResult.finalTerms.confidence?.overall_confidence || null,
      totalPages: parse.pageCount,
      modelUsed: extractionResult.modelUsed || PRIMARY_MODEL,
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
