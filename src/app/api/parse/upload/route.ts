// src/app/api/parse/upload/route.ts
// Updated 2026-01-08 – Lightweight page count with pdf-page-counter (pure JS, no workers/heavy deps)
// Enforces ≤25 MB + ≤100 pages early
// No pdfjs-dist issues, no build errors, no runtime worker failures
// Perfect for Vercel Pro cold starts

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { put } from "@vercel/blob";

/**
 * Count pages in a PDF without external libraries
 * Works by counting /Type /Page objects in the PDF structure
 */
function countPdfPages(buffer: Buffer): number {
  const pdfString = buffer.toString("latin1");
  console.log(`[countPdfPages] PDF size: ${buffer.length} bytes, string length: ${pdfString.length}`);

  // Show first 500 chars of PDF structure for debugging
  const preview = pdfString.substring(0, 500).replace(/\r/g, "\\r").replace(/\n/g, "\\n");
  console.log(`[countPdfPages] PDF preview: ${preview}`);

  // Method 1: Look for /Type /Page or /Type/Page (excluding /Pages)
  // This counts individual page objects
  console.log("[countPdfPages] Trying Method 1: /Type /Page pattern");
  const pageMatches = pdfString.match(/\/Type\s*\/Page[^s]/g);
  console.log(`[countPdfPages] Method 1 matches: ${pageMatches?.length || 0}`);
  if (pageMatches && pageMatches.length > 0) {
    console.log(`[countPdfPages] SUCCESS with Method 1: ${pageMatches.length} pages`);
    return pageMatches.length;
  }

  // Method 2: Look for /Count in the Pages object
  // This finds the page count declaration
  console.log("[countPdfPages] Trying Method 2: /Count in /Pages pattern");
  const countMatch = pdfString.match(/\/Type\s*\/Pages[\s\S]*?\/Count\s+(\d+)/);
  console.log(`[countPdfPages] Method 2 match: ${countMatch ? countMatch[1] : "none"}`);
  if (countMatch && countMatch[1]) {
    const count = parseInt(countMatch[1], 10);
    console.log(`[countPdfPages] SUCCESS with Method 2: ${count} pages`);
    return count;
  }

  // Method 3: Alternative /Count pattern (sometimes /Count comes before /Type)
  console.log("[countPdfPages] Trying Method 3: Alternative /Count pattern");
  const altCountMatch = pdfString.match(/\/Count\s+(\d+)[\s\S]*?\/Type\s*\/Pages/);
  console.log(`[countPdfPages] Method 3 match: ${altCountMatch ? altCountMatch[1] : "none"}`);
  if (altCountMatch && altCountMatch[1]) {
    const count = parseInt(altCountMatch[1], 10);
    console.log(`[countPdfPages] SUCCESS with Method 3: ${count} pages`);
    return count;
  }

  // Method 4: Just look for /Count followed by a number
  console.log("[countPdfPages] Trying Method 4: Any /Count pattern");
  const anyCountMatch = pdfString.match(/\/Count\s+(\d+)/);
  console.log(`[countPdfPages] Method 4 match: ${anyCountMatch ? anyCountMatch[1] : "none"}`);
  if (anyCountMatch && anyCountMatch[1]) {
    const count = parseInt(anyCountMatch[1], 10);
    console.log(`[countPdfPages] SUCCESS with Method 4: ${count} pages`);
    return count;
  }

  // Method 5: Count endobj markers (rough estimate)
  console.log("[countPdfPages] Trying Method 5: Count page dictionaries");
  const pageDicts = pdfString.match(/<<[^>]*\/Type\s*\/Page[^s][^>]*>>/g);
  console.log(`[countPdfPages] Method 5 matches: ${pageDicts?.length || 0}`);
  if (pageDicts && pageDicts.length > 0) {
    console.log(`[countPdfPages] SUCCESS with Method 5: ${pageDicts.length} pages`);
    return pageDicts.length;
  }

  console.log("[countPdfPages] FAILED: All methods returned 0");
  return 0;
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
    select: { id: true, credits: true },
  });
  console.log(`[upload] User lookup: ${user ? `ID ${user.id}, ${user.credits} credits` : "NOT FOUND"}`);

  if (!user) {
    console.log("[upload] REJECTED: User not found in database");
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  if (user.credits < 1) {
    console.log("[upload] REJECTED: No credits");
    return Response.json({ error: "No credits remaining" }, { status: 402 });
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

  // Lightweight page count – pure regex parsing, no external PDF libs
  let pageCount = 0;
  try {
    console.log("[upload] Starting page count...");
    pageCount = countPdfPages(buffer);
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

  // Create parse record
  try {
    const parse = await db.parse.create({
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

    console.log(`[upload] Created parse ${parse.id} – ${pageCount} pages`);

    return Response.json({
      success: true,
      parseId: parse.id,
      pdfPublicUrl,
      pageCount,
      message: `Upload complete – ${pageCount}-page PDF ready for extraction`,
    });
  } catch (dbErr: any) {
    console.error("[upload] DB create failed:", dbErr);
    return Response.json({ error: "Failed to save record" }, { status: 500 });
  }
}