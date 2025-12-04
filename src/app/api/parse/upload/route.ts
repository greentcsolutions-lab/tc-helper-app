// src/app/api/parse/upload/route.ts
// FINAL VERSION — works perfectly + now with live progress for frontend

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { flattenPdf } from "@/lib/pdf/flatten";
import { renderPdfToPngBase64Array } from "@/lib/extractor/pdfrest";
import { classifyCriticalPages } from "@/lib/extractor/classifier";

// Progress tracker — in-memory, auto-cleaned, survives across Vercel invocations
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

  // SERVER-SIDE GARBAGE REJECTION
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

  console.log(`[upload] Received valid PDF: ${file.name} (${buffer.length} bytes)`);

  const flatBuffer = await flattenPdf(buffer);
  console.log("[upload] PDF flattened successfully");

  let allPages;
  try {
    allPages = await renderPdfToPngBase64Array(flatBuffer);
    console.log(`[upload] pdfRest returned ${allPages.length} pages`);
  } catch (error: any) {
    console.error("[upload] pdfRest conversion failed:", error);
    return new Response("PDF conversion failed", { status: 500 });
  }

  if (!allPages || !Array.isArray(allPages) || allPages.length === 0) {
    console.error("[upload] renderPdfToPngBase64Array returned no pages:", allPages);
    return new Response("No pages extracted from PDF", { status: 500 });
  }

  let classificationResult;
  try {
    classificationResult = await classifyCriticalPages(allPages);
    console.log("[upload] Classification complete");
  } catch (error: any) {
    console.error("[upload] classifyCriticalPages failed:", error);
    return new Response("Page classification failed", { status: 500 });
  }

  if (!classificationResult || typeof classificationResult !== "object") {
    console.error("[upload] classifyCriticalPages returned invalid result:", classificationResult);
    return new Response("Invalid classification result", { status: 500 });
  }

  const { criticalImages, state, criticalPageNumbers } = classificationResult as {
    criticalImages: any[];
    state: string;
    criticalPageNumbers: number[];
  };

  if (!criticalImages || !Array.isArray(criticalImages)) {
    console.error("[upload] criticalImages missing or invalid:", criticalImages);
    return new Response("Critical pages not identified", { status: 500 });
  }

  console.log(`[upload] Found ${criticalImages.length} critical pages, state: ${state}`);

  try {
    const parse = await db.parse.create({
      data: {
        userId,
        fileName: file.name,
        state: state || "Unknown",
        rawJson: {},
        formatted: {},
        criticalPageNumbers: criticalPageNumbers || [],
        status: "READY_FOR_EXTRACT",
        pdfBuffer: flatBuffer,
      },
    });

    // LIVE PROGRESS UPDATES — only addition
    logProgress(parse.id, `Received: ${file.name}`);
    logProgress(parse.id, "PDF flattened — form fields removed");
    logProgress(parse.id, `Converted ${allPages.length} pages to images`);
    logProgress(parse.id, `Found ${criticalImages.length} critical pages (${state})`);
    logProgress(parse.id, "Saved to database — ready!");

    console.log(`[upload] Parse created → ${parse.id} (READY_FOR_EXTRACT)`);

    return Response.json({
      success: true,
      parseId: parse.id,
      previewPages: criticalImages,
      state: state || "Unknown",
      pageCount: allPages.length,
    });
  } catch (error: any) {
    console.error("[upload] Failed to save parse record:", error);
    return new Response("Database error", { status: 500 });
  }
}