// src/app/api/parse/upload/route.ts
// REFACTORED: Uses pdfjs-dist for robust page count on messy PDFs
// Validates, stores PDF, detects page count, returns parseId

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { put } from "@vercel/blob";
import * as pdfjs from "pdfjs-dist/build/pdf.mjs"; // ESM import

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
  const uint8Array = new Uint8Array(buffer); // pdfjs prefers Uint8Array

  // Quick header validation
  if (!buffer.subarray(0, 8).toString().includes("%PDF")) {
    return Response.json({ error: "invalid_pdf" }, { status: 400 });
  }
  if (buffer.length > 25_000_000) {
    return Response.json({ error: "File too large – max 25 MB" }, { status: 400 });
  }

  console.log(`[upload] Received ${file.name} (${(buffer.length / 1e6).toFixed(1)} MB)`);

  // Detect page count with pdfjs-dist (more robust for messy PDFs)
  let pageCount = 0;
  try {
    // Set up pdfjs worker (required for Node.js)
    pdfjs.GlobalWorkerOptions.workerSrc = "pdfjs-dist/build/pdf.worker.mjs";

    const loadingTask = pdfjs.getDocument(uint8Array);
    const pdfDoc = await loadingTask.promise;
    pageCount = pdfDoc.numPages;
    console.log(`[upload] Detected ${pageCount} pages with pdfjs-dist`);
  } catch (err) {
    console.error("[upload] Failed to detect page count with pdfjs:", err);
    return Response.json({ error: "Failed to read PDF structure – possibly corrupted or non-standard PDF" }, { status: 400 });
  }

  // Upload first: ensures we only create DB record when storage succeeded
  let pdfPublicUrl: string | undefined;
  try {
    console.log("[upload] Uploading to Vercel Blob...");
    const res = await put(`uploads/${Date.now()}-${file.name}`, buffer, {
      access: "public",
      addRandomSuffix: true,
    });

    pdfPublicUrl = (res as any)?.url;
    if (!pdfPublicUrl) {
      console.error("[upload] Vercel put returned empty URL");
      return Response.json({ success: false, error: "Blob upload returned empty URL" }, { status: 500 });
    }

    console.log(`[upload] Uploaded PDF to Vercel Blob: ${pdfPublicUrl}`);
  } catch (uploadErr: any) {
    console.error("[upload] Vercel blob upload failed:", uploadErr);
    return Response.json({ success: false, error: String(uploadErr) }, { status: 500 });
  }

  // Create parse record only after successful upload
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

    console.log(`[upload] Created parse ${parse.id} - ${pageCount} pages, ready for extraction`);
    return Response.json({
      success: true,
      parseId: parse.id,
      pdfPublicUrl,
      pageCount,
      message: `Upload complete - ${pageCount}-page PDF ready for extraction`,
    });
  } catch (dbErr: any) {
    // Optionally: attempt to delete the uploaded blob to avoid orphaned files (not implemented here)
    console.error("[upload] DB create failed after successful upload:", dbErr);
    return Response.json({ success: false, error: "Failed to create parse record after upload" }, { status: 500 });
  }
}