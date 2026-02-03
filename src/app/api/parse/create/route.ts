// src/app/api/parse/create/route.ts
// Version: 1.0.0 - 2026-01-30
// Creates parse record after client has uploaded PDF to Blob
// Counts pages using unpdf and validates user quota/credits

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { getDocumentProxy } from "unpdf";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Count pages by fetching PDF from Blob URL
 */
async function countPdfPages(pdfUrl: string): Promise<number> {
  console.log(`[countPdfPages] Fetching PDF from: ${pdfUrl}`);
  
  try {
    const response = await fetch(pdfUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    console.log(`[countPdfPages] PDF size: ${arrayBuffer.byteLength} bytes`);
    
    const pdf = await getDocumentProxy(uint8Array);
    const pageCount = pdf.numPages;
    
    console.log(`[countPdfPages] SUCCESS: ${pageCount} pages detected`);
    return pageCount;
  } catch (error) {
    console.error("[countPdfPages] ERROR:", error);
    throw new Error("Failed to parse PDF structure");
  }
}

export async function POST(req: NextRequest) {
  console.log("[create] === NEW PARSE RECORD REQUEST ===");
  
  const { userId: clerkUserId } = await auth();
  console.log(`[create] Clerk user ID: ${clerkUserId || "NONE"}`);
  
  if (!clerkUserId) {
    console.log("[create] REJECTED: No clerk user ID");
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

  console.log(`[create] User lookup: ${user ? `ID ${user.id}, ${user.credits} credits, ${user.planType} plan` : "NOT FOUND"}`);
  
  if (!user) {
    console.log("[create] REJECTED: User not found in database");
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  // Check if parse count needs to be reset (monthly refresh for BASIC plan only)
  const now = new Date();
  let parseCount = user.parseCount;
  let needsReset = false;

  if (user.planType === 'BASIC' && user.parseResetDate && now >= user.parseResetDate) {
    console.log("[create] Parse count reset is due for BASIC user, resetting to 0");
    needsReset = true;
    parseCount = 0;
  }

  // Check parse limit
  if (parseCount >= user.parseLimit) {
    console.log(`[create] REJECTED: Parse limit reached (${parseCount}/${user.parseLimit})`);
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

  // Check credits
  if (user.credits < 1) {
    console.log("[create] REJECTED: No credits");
    return Response.json(
      {
        error: "No credits remaining",
        canBuyCredits: true,
      },
      { status: 402 }
    );
  }

  // Check concurrent transaction quota
  const activeParseCount = await db.parse.count({
    where: {
      userId: user.id,
      archived: false,
    },
  });

  console.log(`[create] Active transactions: ${activeParseCount}/${user.quota}`);
  
  if (activeParseCount >= user.quota) {
    console.log(`[create] REJECTED: Quota limit reached (${activeParseCount}/${user.quota})`);
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

  // Get request body
  const body = await req.json();
  const { fileName, pdfUrl, fileSize } = body;

  if (!fileName || !pdfUrl) {
    console.log("[create] REJECTED: Missing fileName or pdfUrl");
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  console.log(`[create] File: ${fileName}, URL: ${pdfUrl}, Size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

  // Count pages by fetching PDF from Blob
  let pageCount = 0;
  try {
    console.log("[create] Starting page count...");
    pageCount = await countPdfPages(pdfUrl);
    console.log(`[create] Page count result: ${pageCount}`);
    
    if (pageCount === 0) {
      console.log("[create] REJECTED: Could not detect any pages");
      return Response.json(
        { error: "Could not detect pages – possibly corrupted or non-standard PDF" },
        { status: 400 }
      );
    }
    
    if (pageCount > 100) {
      console.log(`[create] REJECTED: Too many pages (${pageCount} > 100)`);
      return Response.json(
        { error: "PDF exceeds 100 pages – too large for processing" },
        { status: 400 }
      );
    }
    
    console.log(`[create] ✓ Detected ${pageCount} pages`);
  } catch (err) {
    console.error("[create] EXCEPTION during page count:", err);
    console.error("[create] Stack trace:", (err as Error).stack);
    return Response.json(
      { error: "Failed to read PDF – possibly corrupted or non-standard" },
      { status: 400 }
    );
  }

  // Create parse record and deduct credit
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
        parseCount = 0;
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

      // Create the parse record (no pdfBuffer since we have public URL)
      const parse = await tx.parse.create({
        data: {
          userId: user.id,
          fileName,
          state: "Unknown",
          status: "UPLOADED",
          pdfPublicUrl: pdfUrl,
          pageCount,
          rawJson: {},
          formatted: {},
          criticalPageNumbers: [],
        },
      });

      return { parse };
    });

    const createdParse = transactionResult.parse;

    console.log(`[create] Created parse ${createdParse.id} – ${pageCount} pages, parseCount incremented to ${parseCount + 1}`);
    
    return Response.json({
      success: true,
      parseId: createdParse.id,
      pdfUrl,
      pageCount,
      message: `Parse record created – ${pageCount}-page PDF ready for extraction`,
    });
  } catch (dbErr: any) {
    console.error("[create] DB create failed:", dbErr);
    return Response.json(
      { error: "Failed to save record" },
      { status: 500 }
    );
  }
}
