// src/app/api/parse/upload/route.ts
// Updated 2026-01-08 – Lightweight page count with pdf-page-counter (pure JS, no workers/heavy deps)
// Enforces ≤25 MB + ≤100 pages early
// No pdfjs-dist issues, no build errors, no runtime worker failures
// Perfect for Vercel Pro cold starts

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { put } from "@vercel/blob";
import pdfPageCounter from "pdf-page-counter"; // Tiny pure-JS parser – just for page count

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return new Response("Unauthorized", { status: 401 });

  const user = await db.user.findUnique({
    where: { clerkId: clerkUserId },
    select: { id: true, credits: true },
  });

  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  if (user.credits < 1) {
    return Response.json({ error: "No credits remaining" }, { status: 402 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File;
  if (!file) return Response.json({ error: "No file" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());

  // Quick validation
  if (!buffer.subarray(0, 8).toString().includes("%PDF")) {
    return Response.json({ error: "invalid_pdf" }, { status: 400 });
  }
  if (buffer.length > 25_000_000) {
    return Response.json({ error: "File too large – max 25 MB" }, { status: 400 });
  }

  console.log(`[upload] Received ${file.name} (${(buffer.length / 1e6).toFixed(1)} MB)`);

  // Lightweight page count – no workers, no heavy libs
  let pageCount = 0;
  try {
    const data = await pdfPageCounter(new Uint8Array(buffer));
    pageCount = data.numpages;

    if (pageCount > 100) {
      return Response.json({ error: "PDF exceeds 100 pages – too large for processing" }, { status: 400 });
    }

    console.log(`[upload] Detected ${pageCount} pages with pdf-page-counter`);
  } catch (err) {
    console.error("[upload] Failed to count pages:", err);
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