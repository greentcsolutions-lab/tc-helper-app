// src/app/api/parse/upload/route.ts
// FINAL: No Grok until user confirms — uses first 9 pages only

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { flattenPdf } from "@/lib/pdf/flatten";
import { renderPdfToPngBase64Array } from "@/lib/extractor/pdfrest";
import { uploadProgress } from "@/lib/progress";

export const runtime = "nodejs";
export const maxDuration = 60;

function logProgress(parseId: string, message: string) {
  const existing = uploadProgress.get(parseId) || [];
  existing.push({ message, timestamp: Date.now() });
  uploadProgress.set(parseId, existing);
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File;
  if (!file) return new Response("No file uploaded", { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());

  // Validation
  if (!buffer.subarray(0, 8).toString().includes("%PDF")) {
    return Response.json({ error: "invalid_pdf" }, { status: 400 });
  }
  if (buffer.length < 10_000 || buffer.length > 100_000_000) {
    return Response.json({ error: "invalid_size" }, { status: 400 });
  }

  console.log(`[upload] Processing ${file.name} (${buffer.length} bytes)`);

  const flatBuffer = await flattenPdf(buffer);
  console.log("[upload] PDF flattened");

  // ONLY first 9 pages — no Grok, no classifier
  const previewPages = await renderPdfToPngBase64Array(flatBuffer, { maxPages: 9 });

  const parse = await db.parse.create({
    data: {
      userId,
      fileName: file.name,
      state: "Unknown",
      status: "AWAITING_CONFIRMATION",
      pdfBuffer: flatBuffer,
      rawJson: {},    
      formatted: {},  
    },
  });

  logProgress(parse.id, `Uploaded: ${file.name}`);
  logProgress(parse.id, "Flattened PDF");
  logProgress(parse.id, "Generated first 9 pages");
  logProgress(parse.id, "Waiting for confirmation...");

  return Response.json({
    success: true,
    parseId: parse.id,
    previewPages: previewPages, // first 9 pages only
    totalPagesHint: previewPages.length < 9 ? previewPages.length : "9+",
    message: "Is this the correct document?",
    nextStep: "confirm", // ← triggers your existing preview route next
  });
}