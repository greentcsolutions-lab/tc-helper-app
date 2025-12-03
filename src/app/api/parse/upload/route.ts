// src/app/api/parse/upload/route.ts
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { flattenPdf } from "@/lib/pdf/flatten";
import { renderPdfToPngBase64Array } from "@/lib/extractor/renderer";
import { classifyCriticalPages } from "@/lib/extractor/classifier";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File;
  if (!file) return new Response("No file uploaded", { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());

  // ←←← SERVER-SIDE GARBAGE REJECTION
  const header = buffer.subarray(0, 8).toString();
  if (!header.includes("%PDF")) {
    return Response.json(
      { error: "invalid_pdf", message: "This is not a valid PDF file." },
      { status: 400 }
    );
  }
  if (buffer.length < 10_000) {
    return Response.json(
      { error: "file_too_small", message: "This PDF appears corrupted (too small)." },
      { status: 400 }
    );
  }
  if (buffer.length > 100_000_000) {
    return Response.json(
      { error: "file_too_large", message: "File exceeds 100 MB limit." },
      { status: 400 }
    );
  }

  const flatBuffer = await flattenPdf(buffer);
  const allPages = await renderPdfToPngBase64Array(flatBuffer);
  const { criticalImages, state, criticalPageNumbers } = await classifyCriticalPages(allPages);

  const parse = await db.parse.create({
    data: {
      userId,
      fileName: file.name,
      state,
      rawJson: {},
      formatted: {},
      criticalPageNumbers,
      status: "READY_FOR_EXTRACT",
      pdfBuffer: flatBuffer,
    },
  });

  return Response.json({
    success: true,
    parseId: parse.id,
    previewPages: criticalImages,
    state,
    pageCount: allPages.length,
  });
}