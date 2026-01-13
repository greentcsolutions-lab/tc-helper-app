// src/app/api/parse/extract/[parseId]/route.ts
// Version: 7.1.0 - 2026-01-13
// Added 60s timeout fallback to Gemini 2.5 Flash-Lite for preview stability
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { mapExtractionToParseResult } from "@/lib/parse/map-to-parse-result";
import { extractWithGemini } from "@/lib/extraction/gemini/extractPdf";
import { logStep, logSuccess, logError, logWarn } from "@/lib/debug/parse-logger"; // assuming you have/want logWarn

export const runtime = "nodejs";
export const maxDuration = 300; // still safe ceiling

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
  console.log(`[extract] START parseId=${parseId}`);

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

    // Primary: Gemini 3 Flash Preview with 60s timeout
    let extractionResult;
    const PRIMARY_MODEL = "gemini-3-flash-preview";
    const FALLBACK_MODEL = "gemini-2.5-flash-lite";

    try {
      extractionResult = await Promise.race([
        extractWithGemini(parse.pdfPublicUrl, parse.pageCount, PRIMARY_MODEL), // pass model if your fn supports it (see note below)
        timeoutPromise(60000), // 60 seconds
      ]);
      console.log(`[extract] Primary (${PRIMARY_MODEL}) success`);
    } catch (err: any) {
      if (err.message.includes("timeout")) {
        logWarn(
          "EXTRACT:FALLBACK",
          `Primary Gemini 3 Flash Preview timed out after 60s → falling back to ${FALLBACK_MODEL}`
        );
        // Fallback attempt
        extractionResult = await extractWithGemini(
          parse.pdfPublicUrl,
          parse.pageCount,
          FALLBACK_MODEL // pass fallback model
        );
        console.log(`[extract] Fallback (${FALLBACK_MODEL}) success`);
      } else {
        throw err; // rethrow other errors
      }
    }

    console.log(
      `[extract] Extraction complete - confidence: ${
        extractionResult.finalTerms.confidence?.overall_confidence || "N/A"
      }% (from ${extractionResult.modelUsed || "unknown"})`
    );
    logSuccess("EXTRACT:2", `Extraction complete – processed ${parse.pageCount} pages`);

    // Rest of your code unchanged...
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

    // ... your debug logging for dates ...

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
          // ... all other fields ...
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
      modelUsed: extractionResult.modelUsed || PRIMARY_MODEL, // optional: expose to frontend/debug
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
