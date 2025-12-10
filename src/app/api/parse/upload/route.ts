// src/app/api/parse/upload/route.ts
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { renderPdfToS3Direct } from "@/lib/pdf/renderer-s3";
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

  if (!buffer.subarray(0, 8).toString().includes("%PDF")) {
    return Response.json({ error: "invalid_pdf" }, { status: 400 });
  }
  if (buffer.length > 25_000_000) {
    return Response.json({ error: "File too large — max 25 MB" }, { status: 400 });
  }

  console.log(`[upload] Processing ${file.name} (${(buffer.length / 1e6).toFixed(1)} MB)`);

  const tempId = crypto.randomUUID();
  uploadProgress.set(tempId, []);

  logProgress(tempId, `Received: ${file.name}`);
  logProgress(tempId, "Securing document — flattening form fields and signatures...");
  logProgress(tempId, "Sending to secure rendering engine (Nutrient → S3 direct)...");

  // Create parse record first
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

  // Migrate progress
  uploadProgress.delete(tempId);
  uploadProgress.set(parse.id, [
    { message: `Received: ${file.name}`, timestamp: Date.now() - 30000 },
    { message: "Securing document — flattening form fields and signatures...", timestamp: Date.now() - 25000 },
    { message: "Sending to secure rendering engine (Nutrient → S3 direct)...", timestamp: Date.now() - 20000 },
  ]);

  // Background render
  (async () => {
    try {
      logProgress(parse.id, "Rendering pages to high-res PNGs (310 DPI)...");

      const result = await renderPdfToS3Direct(buffer, {
        parseId: parse.id,
        dpi: 310,
      });

      logProgress(parse.id, `Render complete — ${result.pageCount} pages ready`);
      logProgress(parse.id, "Ready for AI analysis — click Continue");

      await db.parse.update({
        where: { id: parse.id },
        data: {
          status: "RENDERED",
          renderZipUrl: result.zipUrl,
          renderZipKey: result.zipKey,
          pageCount: result.pageCount,
        },
      });

      console.log(`[parse:${parse.id}] S3 render complete`);
    } catch (error: any) {
      console.error(`[parse:${parse.id}] Render failed`, error);
      logProgress(parse.id, "Rendering failed — please try again");

      await db.parse.update({
        where: { id: parse.id },
        data: {
          status: "RENDER_FAILED",
          errorMessage: error.message?.slice(0, 500) || "Unknown rendering error",
        },
      });
    }
  })();

  return Response.json({
    success: true,
    parseId: parse.id,
    message: "Document received — rendering in background",
    nextStep: "wait_for_render",
    previewPages: [],
  });
}