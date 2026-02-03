// src/app/api/parse/upload/route.ts
// Updated 2026-01-08 – Robust page count with unpdf (Mozilla PDF.js for serverless)
// Enforces ≤25 MB + ≤100 pages early
// Handles encrypted, compressed, flattened PDFs reliably
// Zero dependencies, perfect for Vercel Pro cold starts
// FIXED 2026-01-13: parse ID scope issue in transaction/response

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { put } from "@vercel/blob";
import { getDocumentProxy } from "unpdf";

/**
 * Count pages in a PDF using unpdf (Mozilla PDF.js for serverless)
 * Handles encrypted, compressed, flattened, and any PDF structure
 */
async function countPdfPages(buffer: Buffer): Promise<number> {
  console.log(`[countPdfPages] PDF size: ${buffer.length} bytes`);
  try {
    // Convert Buffer to Uint8Array for unpdf
    const uint8Array = new Uint8Array(buffer);
    // Load PDF with unpdf (uses Mozilla PDF.js internally)
    const pdf = await getDocumentProxy(uint8Array);
    const pageCount = pdf.numPages;
    console.log(`[countPdfPages] SUCCESS: ${pageCount} pages detected`);
    return pageCount;
  } catch (error) {
    console.error("[countPdfPages] ERROR:", error);
    throw new Error("Failed to parse PDF structure");
  }
}

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  console.log("[upload] === NEW UPLOAD REQUEST ===");
  const { userId: clerkUserId } = await auth();
  console.log(`[upload] Clerk user ID: ${clerkUserId || "NONE"}`);
  if (!clerkUserId) {
    console.log("[upload] REJECTED: No clerk user ID");
    return new Response("Unauthorized", { status: 401 });
  }
  const user = await db.user.findUnique({
    where: { clerkId: clerkUserId },
    select: {
      id: true,
      credits: true,
      planType: true,
      quota: true,
      parseLimit: true,
      parseCount: true,
      parseResetDate: true,
    },
  });
  console.log(`[upload] User lookup: ${user ? `ID ${user.id}, ${user.credits} credits, ${user.planType} plan` : "NOT FOUND"}`);
  if (!user) {
    console.log("[upload] REJECTED: User not found in database");
    return Response.json({ error: "User not found" }, { status: 404 });
  }
  // Check if parse count needs to be reset (monthly refresh for BASIC plan only)
  const now = new Date();
  let parseCount = user.parseCount;
  let needsReset = false;
  // Only reset for BASIC plan users (FREE plan never resets)
  if (user.planType === 'BASIC' && user.parseResetDate && now >= user.parseResetDate) {
    console.log("[upload] Parse count reset is due for BASIC user, resetting to 0");
    needsReset = true;
    parseCount = 0;
    // Calculate next reset date (one month from now)
    const nextReset = new Date(now);
    nextReset.setMonth(nextReset.getMonth() + 1);
    // Update user with reset values
    await db.user.update({
      where: { id: user.id },
      data: {
        parseCount: 0,
        parseResetDate: nextReset,
      },
    });
  }
  // Check parse limit
  if (parseCount >= user.parseLimit) {
    console.log(`[upload] REJECTED: Parse limit reached (${parseCount}/${user.parseLimit})`);
    const errorMessage = user.planType === 'FREE'
      ? "Free tier parse limit reached"
      : "Monthly parse limit reached";
    return Response.json(
      {
        error: errorMessage,
        parseCount,
        parseLimit: user.parseLimit,
        canBuyCredits: true,
      },
      { status: 402 }
    );
  }
  // Check credits (for actual API usage)
  if (user.credits < 1) {
    console.log("[upload] REJECTED: No credits");
    return Response.json(
      {
        error: "No credits remaining",
        canBuyCredits: true,
      },
      { status: 402 }
    );
  }
  // Check concurrent transaction quota (count only non-archived parses)
  const activeParseCount = await db.parse.count({
    where: {
      userId: user.id,
      archived: false,
    },
  });
  console.log(`[upload] Active transactions: ${activeParseCount}/${user.quota}`);
  if (activeParseCount >= user.quota) {
    console.log(`[upload] REJECTED: Quota limit reached (${activeParseCount}/${user.quota})`);
    return Response.json(
      {
        error: "Concurrent transaction limit reached",
        activeParseCount,
        quota: user.quota,
        message: "Archive or delete existing transactions to upload new files",
      },
      { status: 402 }
    );
  }
  const formData = await req.formData();
  const file = formData.get("file") as File;
  if (!file) {
    console.log("[upload] REJECTED: No file in form data");
    return Response.json({ error: "No file" }, { status: 400 });
  }
  console.log(`[upload] File received: ${file.name}, type: ${file.type}, size: ${file.size} bytes`);
  const buffer = Buffer.from(await file.arrayBuffer());
  console.log(`[upload] Buffer created: ${buffer.length} bytes`);
  // Quick validation
  const header = buffer.subarray(0, 8).toString();
  console.log(`[upload] PDF header check: "${header}"`);
  if (!header.includes("%PDF")) {
    console.log("[upload] REJECTED: Not a valid PDF (missing %PDF header)");
    return Response.json({ error: "invalid_pdf" }, { status: 400 });
  }
  if (buffer.length > 25_000_000) {
    console.log(`[upload] REJECTED: File too large (${(buffer.length / 1e6).toFixed(1)} MB > 25 MB)`);
    return Response.json({ error: "File too large – max 25 MB" }, { status: 400 });
  }
  console.log(`[upload] Received ${file.name} (${(buffer.length / 1e6).toFixed(1)} MB)`);
  // Robust page count using unpdf (Mozilla PDF.js for serverless)
  let pageCount = 0;
  try {
    console.log("[upload] Starting page count...");
    pageCount = await countPdfPages(buffer);
    console.log(`[upload] Page count result: ${pageCount}`);
    if (pageCount === 0) {
      console.log("[upload] REJECTED: Could not detect any pages");
      return Response.json(
        { error: "Could not detect pages – possibly corrupted or non-standard PDF" },
        { status: 400 }
      );
    }
    if (pageCount > 100) {
      console.log(`[upload] REJECTED: Too many pages (${pageCount} > 100)`);
      return Response.json({ error: "PDF exceeds 100 pages – too large for processing" }, { status: 400 });
    }
    console.log(`[upload] ✓ Detected ${pageCount} pages`);
  } catch (err) {
    console.error("[upload] EXCEPTION during page count:", err);
    console.error("[upload] Stack trace:", (err as Error).stack);
    return Response.json(
      { error: "Failed to read PDF – possibly corrupted or non-standard" },
      { status: 400 }
    );
  }
  // Upload to Vercel Blob
  let pdfPublicUrl: string | undefined;
  try {
    console.log("[upload] Uploading to Vercel Blob...");
    const { url } = await put(`uploads/${Date.now()}-${file.name}`, buffer, {
      access: "public",
      addRandomSuffix: true,
    });
    pdfPublicUrl = url;
    console.log(`[upload] Uploaded: ${pdfPublicUrl}`);
  } catch (uploadErr: any) {
    console.error("[upload] Blob upload failed:", uploadErr);
    return Response.json({ error: "Upload failed" }, { status: 500 });
  }
  // Create parse record and increment parseCount
  try {
    const transactionResult = await db.$transaction(async (tx) => {
      // Reset parseCount if needed (BASIC only)
      if (needsReset) {
        const nextReset = new Date(now);
        nextReset.setMonth(nextReset.getMonth() + 1);
        await tx.user.update({
          where: { id: user.id },
          data: {
            parseCount: 0,
            parseResetDate: nextReset,
          },
        });
        parseCount = 0; // sync local var
      }

      // Deduct 1 credit
      await tx.user.update({
        where: { id: user.id },
        data: {
          credits: { decrement: 1 },
        },
      });

      // Increment parseCount
      await tx.user.update({
        where: { id: user.id },
        data: {
          parseCount: { increment: 1 },
        },
      });

      // Create the parse record
      const parse = await tx.parse.create({
        data: {
          userId: user.id,
          fileName: file.name,
          state: "Unknown",
          status: "UPLOADED",
          pdfBuffer: buffer,
          pdfPublicUrl,
          pageCount,
          rawJson: {},
          formatted: {},
          criticalPageNumbers: [],
        },
      });

      return { parse };
    });

    const createdParse = transactionResult.parse;

    console.log(`[upload] Created parse ${createdParse.id} – ${pageCount} pages, parseCount incremented to ${parseCount + 1}`);
    return Response.json({
      success: true,
      parseId: createdParse.id,
      pdfPublicUrl,
      pageCount,
      message: `Upload complete – ${pageCount}-page PDF ready for extraction`,
    });
  } catch (dbErr: any) {
    console.error("[upload] DB create failed:", dbErr);
    return Response.json({ error: "Failed to save record" }, { status: 500 });
  }
}
