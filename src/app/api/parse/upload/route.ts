// src/app/api/parse/upload/route.ts
// Updated to use Vercel Blob offload — returns zipUrl + zipKey

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { renderPdfToPngZipUrl } from "@/lib/pdf/renderer";
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
    return new Response("User not found", { status: 404 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File;
  if (!file) return new Response("No file", { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());

  if (!buffer.subarray(0, 8).toString().includes("%PDF")) {
    return Response.json({ error: "invalid_pdf" }, { status: 400 });
  }
  if (buffer.length > 25_000_000) {
    return Response.json({ error: "File too large — max 25 MB" }, { status: 400 });
  }

  console.log(`[upload] Processing ${file.name} (${(buffer.length / 1e6).toFixed(1)} MB)`);

  const parse = await db.parse.create({
    data: {
      userId: user.id,
      fileName: file.name,
      state: "Unknown",
      status: "PROCESSING",
      pdfBuffer: buffer,
      rawJson: {},
      formatted: {},
      criticalPageNumbers: [],
    },
  });

  // Background render — offloads ZIP to Vercel Blob
  (async () => {
    try {
      const { url, key } = await renderPdfToPngZipUrl(buffer, { maxPages: 9 });

      await db.parse.update({
        where: { id: parse.id },
        data: {
          status: "RENDERED",
          renderZipUrl: url,
          renderZipKey: key,
          pageCount: 9,
        },
      });

      console.log(`[parse:${parse.id}] Preview ZIP ready at ${url}`);
    } catch (error: any) {
      console.error(`[parse:${parse.id}] Render failed`, error);
      await db.parse.update({
        where: { id: parse.id },
        data: {
          status: "RENDER_FAILED",
          errorMessage: error.message,
        },
      });
    }
  })();

  return Response.json({
    success: true,
    parseId: parse.id,
    message: "Document uploaded — generating preview...",
    nextStep: "wait_for_preview",
  });
}