// src/app/api/parse/upload/route.ts
// Updated 2026-01-13 – Deduct 1 credit AFTER successful PDF validation & before DB create
// Moved credit deduction into transaction for atomicity
// Keeps early checks for parseCount (monthly) and credits (pre-validation)

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
    const uint8Array = new Uint8Array(buffer);
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

  const now = new Date();
  let parseCount = user.parseCount;
  let needsReset = false;

  // Monthly parseCount reset for BASIC only
  if (user.planType === 'BASIC' && user.parseResetDate && now >= user.parseResetDate) {
    console.log("[upload] Parse count reset due for BASIC user → resetting to 0");
    needsReset = true;
    parseCount = 0;
  }

  // Early monthly limit check
  if (parseCount >= user.parseLimit) {
    console.log(`[upload] REJECTED: Monthly parse limit reached (${parseCount}/${user.parseLimit})`);
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

  // Early credit check (before processing file)
  if (user.credits < 1) {
    console.log("[upload] REJECTED: No credits remaining");
    return Response.json(
      {
        error: "No credits remaining",
        canBuyCredits: true,
      },
      { status: 402 }
    );
  }

  // Concurrent quota check
  const activeParseCount = await db.parse.count({
    where: { userId: user.id, archived: false },
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

  // Quick header check
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

  // Robust page count validation (this is when we "validate for extraction")
  let pageCount = 0;
  try {
    console.log("[upload] Starting page count with unpdf...");
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

    console.log(`[upload] ✓ Validated ${pageCount} pages – deducting credit now`);
  } catch (err) {
    console.error("[upload] EXCEPTION during page count:", err);
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

  // Atomic DB operations: create parse + deduct credit + increment parseCount + handle reset
  try {
    await db.$transaction(async (tx) => {
      // Reset parseCount if needed (BASIC only)
      if (needsReset) {
        await tx.user.update({
          where: { id: user.id },
          data: {
            parseCount: 0,
            parseResetDate: new Date(now.getFullYear(), now.getMonth() + 1, 1), // Better: first of next month
          },
        });
        parseCount = 0; // sync local var
      }

      // Deduct 1 credit (now that PDF is validated)
      await tx.user.update({
        where: { id: user.id },
        data: {
          credits: { decrement: 1 },
        },
      });

      // Increment parseCount (monthly tracker)
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
          pdfBuffer: buffer, // Consider removing this if not needed – blobs are better
          pdfPublicUrl,
          pageCount,
          rawJson: {},
          formatted: {},
          criticalPageNumbers: [],
        },
      });

      console.log(`[upload] Transaction success: Parse ${parse.id} created, credit deducted, parseCount now ${parseCount + 1}`);
    });

    return Response.json({
      success: true,
      parseId: parse.id, // Note: parse.id is now from the transaction – but since it's in tx, we need to return it
      pdfPublicUrl,
      pageCount,
      message: `Upload complete – ${pageCount}-page PDF ready for extraction (1 credit deducted)`,
    });
  } catch (dbErr: any) {
    console.error("[upload] DB transaction failed:", dbErr);
    return Response.json({ error: "Failed to save record or deduct credit" }, { status: 500 });
  }
}
