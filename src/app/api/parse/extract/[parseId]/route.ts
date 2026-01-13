// src/app/api/parse/extract/[parseId]/route.ts
// Version: 7.2.6 - 2026-01-13
// FIXED: Single properly nested try/catch structure - compiles now

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { mapExtractionToParseResult } from "@/lib/parse/map-to-parse-result";
import * as ParseLogger from "@/lib/debug/parse-logger";

// LLM Processes
import { extractWithGemini } from "@/lib/extraction/gemini/extractPdf";
import { extractWithClaude } from "@/lib/extraction/Claude/extractPdf";
import { checkClaudeAvailability } from "@/lib/extraction/Claude/availability";

const { logStep, logSuccess, logError, logWarn } = ParseLogger;

export const runtime = "nodejs";
export const maxDuration = 300;

// Timeout helper
const timeoutPromise = (ms: number, label = "Operation") =>
  new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`${label} timeout`)), ms)
  );

const PING_TIMEOUT_MS = 4500;
const CLAUDE_FULL_TIMEOUT_MS = 85000;
const GEMINI_FALLBACK_TIMEOUT_MS = 110000;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ parseId: string }> }
) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return new Response("Unauthorized", { status: 401 });

  const { parseId } = await params;
  console.log(`[extract] START parseId=${parseId} at ${new Date().toISOString()}`);

  let parse;
  let extractionResult;

  const PRIMARY_MODEL = "claude-4-sonnet-20250514";
  const FALLBACK_MODEL = "gemini-3-flash-preview";

  try {
    // Load parse record
    logStep("EXTRACT:1", "Loading parse record...");
    parse = await db.parse.findUnique({
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

    // Try primary Claude path
    logStep("EXTRACT:2", `Trying primary: ${PRIMARY_MODEL}`);

    console.log(`[claude-check] Quick ping (${PING_TIMEOUT_MS/1000}s max)...`);
    const isClaudeResponsive = await Promise.race([
      checkClaudeAvailability(),
      timeoutPromise(PING_TIMEOUT_MS, "Claude ping")
    ]).catch(() => false);

    if (!isClaudeResponsive) {
      console.warn(`[claude-check] Not responsive quickly → fallback`);
      throw new Error("Claude ping failed");
    }

    console.log(`[claude-check] Alive → full extraction`);
    extractionResult = await Promise.race([
      extractWithClaude(parse.pdfPublicUrl, parse.pageCount, PRIMARY_MODEL),
      timeoutPromise(CLAUDE_FULL_TIMEOUT_MS, "Claude extraction")
    ]);

    console.log(`[extract] Primary (${PRIMARY_MODEL}) SUCCESS`);
  } catch (err: any) {
    // Primary path failed (ping or full extraction) → fallback to Gemini
    console.log(`[extract] Primary failed: ${err.message}`);

    logWarn("EXTRACT:FALLBACK", `Falling back to ${FALLBACK_MODEL}`);

    try {
      extractionResult = await Promise.race([
        extractWithGemini(parse.pdfPublicUrl, parse.pageCount, FALLBACK_MODEL),
        timeoutPromise(GEMINI_FALLBACK_TIMEOUT_MS, "Gemini fallback")
      ]);

      console.log(`[extract] Fallback (${FALLBACK_MODEL}) SUCCESS`);
      extractionResult = { ...extractionResult, fromFallback: true };
    } catch (fallbackErr: any) {
      console.error(`[extract] Fallback failed too: ${fallbackErr.message}`);
      throw fallbackErr;
    }
  }

  // ── Only reached if we have a result ──────────────────────────────────────
  if (!extractionResult) {
    throw new Error("No extraction result from any provider");
  }

  const modelUsed = extractionResult.modelUsed ||
    (extractionResult.fromFallback ? FALLBACK_MODEL : PRIMARY_MODEL);

  console.log(
    `[extract] Extraction complete - confidence: ${
      extractionResult.finalTerms?.confidence?.overall_confidence || "N/A"
    }% (from ${modelUsed})`
  );

  logSuccess("EXTRACT:2", `Extraction complete – processed ${parse.pageCount} pages`);

  logStep("EXTRACT:3", "Mapping to Parse fields...");
  const mappedFields = mapExtractionToParseResult({
    universal: extractionResult.finalTerms,
    route: modelUsed,
    details: {
      criticalPages: extractionResult.criticalPages,
      allExtractions: extractionResult.allExtractions,
    },
    timelineEvents: [],
  });

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
    needsReview: extractionResult.needsReview ?? false,
    confidence: extractionResult.finalTerms?.confidence?.overall_confidence ?? null,
    totalPages: parse.pageCount,
    modelUsed,
  });
} catch (error: any) {
  // Final safety net for any uncaught error
  logError("EXTRACT:ERROR", error.message);
  console.error("[Extract Route] Full error:", error);
  return Response.json(
    { error: error.message || "Extraction failed" },
    { status: 500 }
  );
}
