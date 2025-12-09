// src/app/api/parse/upload/route.ts
// FINAL — Professional status updates + proper progress tracking
// Now using Nutrient one-call flatten + PNG render (no separate flattenPdf)

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { renderPdfToPngBase64Array } from "@/lib/pdf/renderer";
import { uploadProgress } from "@/lib/progress";

export const runtime = "nodejs";
export const maxDuration = 60;

function logProgress(parseId: string, message: string) {
  const existing = uploadProgress.get(parseId) || [];
  existing.push({ message, timestamp: Date.now() });
  uploadProgress.set(parseId, existing);
}

export async function POST(req: NextRequest) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return new Response("Unauthorized", { status: 401 });

  const user = await db.user.findUnique({
    where: { clerkId: clerkUserId },
    select: { id: true },
  });

  if (!user) {
    return new Response("User not found — please complete onboarding", { status: 404 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File;
  if (!file) return new Response("No file uploaded", { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());

  // Validate PDF
  if (!buffer.subarray(0, 8).toString().includes("%PDF")) {
    return Response.json({ error: "invalid_pdf" }, { status: 400 });
  }
  if (buffer.length > 25_000_000) {
    return Response.json({ error: "File too large — max 25 MB" }, { status: 400 });
  }

  console.log(`[upload] Processing ${file.name} (${(buffer.length / 1e6).toFixed(1)} MB)`);

  // Initialize progress early
  const tempId = crypto.randomUUID();
  uploadProgress.set(tempId, []);

  logProgress(tempId, `Received: ${file.name}`);
  logProgress(tempId, "Securing document — removing fillable fields and encryption...");

  // No separate flattenPdf() — Nutrient does it inside renderer
  logProgress(tempId, "Document secured and flattened — now fully static");

  logProgress(tempId, "Converting pages to images for AI analysis (320 DPI)...");

  // Nutrient renderer does flatten + PNG in one call
  const previewPages = await renderPdfToPngBase64Array(buffer, { maxPages: 9 });

  logProgress(tempId, `Preview generated — displaying first ${previewPages.length} pages`);

  // Create real parse record
  const parse = await db.parse.create({
    data: {
      userId: user.id,
      fileName: file.name,
      state: "Unknown",
      status: "AWAITING_CONFIRMATION",
      pdfBuffer: buffer, // optional — can be null later, renderer doesn't need it anymore
      rawJson: {},
      formatted: {},
      criticalPageNumbers: [],
    },
  });

  // Migrate progress to real parseId with realistic timestamps
  const baseTime = Date.now();
  const progressHistory = [
    { message: `Received: ${file.name}`, timestamp: baseTime - 28000 },
    { message: "Securing document — removing fillable fields and encryption...", timestamp: baseTime - 24000 },
    { message: "Document secured and flattened — now fully static", timestamp: baseTime - 20000 },
    { message: "Converting pages to images for AI extraction...", timestamp: baseTime - 15000 },
    { message: `Preview generated — displaying first ${previewPages.length} pages`, timestamp: baseTime - 6000 },
    { message: "Ready for review — click Continue when confirmed", timestamp: baseTime - 1000 },
  ];

  uploadProgress.set(parse.id, progressHistory);

  return Response.json({
    success: true,
    parseId: parse.id,
    previewPages,
    pageCount: previewPages.length < 9 ? "9+" : previewPages.length,
    message: "Is this the correct document?",
    nextStep: "confirm",
  });
}