// src/app/api/parse/extract/[parseId]/route.ts
// Version: 7.2.2 - 2026-01-13
// Fixed try/catch nesting + flow control

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

// ── Timeout helper ──────────────────────────────────────────────────────────
const timeoutPromise = (ms: number, label = "Operation") =>
  new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`${label} timeout`)), ms)
  );

// Recommended timeouts (milliseconds)
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

  let extractionResult;
  const PRIMARY_MODEL = "claude-4-sonnet-20250514";
  const FALLBACK_MODEL = "gemini-3-flash-preview";

  try {
    // ── Load parse record ─────────────────────────────────────────────────
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

    // ── Phase 1: Quick availability ping ──────────────────────────────────
    logStep("EXTRACT:2", `Trying primary: ${PRIMARY_MODEL}`);
    console.log(`[claude-check] Quick availability ping (max ${PING_TIMEOUT_MS/1000}s)...`);

    const isClaudeResponsive = await Promise.race([
      checkClaudeAvailability(),
      timeoutPromise(PING_TIMEOUT_MS, "Claude availability ping"),
    ]).catch(() => false);

    if (!isClaudeResponsive) {
      console.warn(`[claude-check] Primary model not quickly available → early fallback`);
      throw new Error("Claude availability check failed");
    }

    console.log(`[claude-check] Looks alive ✓ Proceeding with full extraction`);

    // ── Phase 2: Full expensive primary extraction ────────────────────────
    console.log(`[extract] Starting full extraction with ${PRIMARY_MODEL}...`);

    extractionResult = await Promise.race([
      extractWithClaude(parse.pdfPublicUrl, parse.pageCount, PRIMARY_MODEL),
      timeoutPromise(CLAUDE_FULL_TIMEOUT_MS, "Claude full extraction"),
    ]);

    console.log(`[extract] Primary (${PRIMARY_MODEL}) SUCCESS`);
  } catch (primaryError: any) {
    // ── Primary path failed (ping or full extraction) → try fallback ─────
    const isTimeout = primaryError.message?.includes("timeout");
    console.log(
      `[extract] Primary path failed (${isTimeout ? "timeout" : "error"}): ${primaryError.message}`
    );

    logWarn("EXTRACT:FALLBACK", `Falling back to ${FALLBACK_MODEL}`);

    try {
      console.log(`[extract] Starting fallback extraction with ${FALLBACK_MODEL}...`);

      extractionResult = await Promise.race([
        extractWithGemini(parse.pdfPublicUrl, parse.pageCount, FALLBACK_MODEL),
        timeoutPromise(GEMINI_FALLBACK_TIMEOUT_MS, "Gemini fallback extraction"),
      ]);

      console.log(`[extract] Fallback (${FALLBACK_MODEL}) SUCCESS`);
      // Optional: mark that we used fallback
      extractionResult = { ...extractionResult, fromFallback: true };
    } catch (fallbackError: any) {
      console.error(`[extract] Fallback also failed: ${fallbackError.message}`);
      logError("EXTRACT:ERROR", `Both providers failed: ${fallbackError.message}`);
      throw fallbackError; // → outer catch
    }
  }

  // ── At this point we should have extractionResult or have thrown ───────
  if (!extractionResult) {
    throw new Error("No extraction result received from either provider");
  }

  // ── Result processing & database save ─────────────────────────────────
  const modelUsed =
    extractionResult.modelUsed ||
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

  // Debug print dates
  console.log("[extract] Timeline dates being saved:");
  console.log(" effectiveDate:", mappedFields.effectiveDate);
  console.log(" initialDepositDueDate:", mappedFields.initialDepositDueDate);
  console.log(" sellerDeliveryOfDisclosuresDate:", mappedFields.sellerDeliveryOfDisclosuresDate);
  console.log(" closingDate:", mappedFields.closingDate);

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
  // Final safety net for any unhandled error
  logError("EXTRACT:ERROR", error.message);
  console.error("[Extract Route] Full error:", error);
  return Response.json(
    { error: error.message || "Extraction failed" },
    { status: 500 }
  );
}
