// src/app/api/parse/route.ts
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { flattenPdf } from "@/lib/pdf/flatten";
import { renderPdfToPngBase64Array } from "@/lib/extractor/renderer";
import { classifyCriticalPages } from "@/lib/extractor/classifier";
import { extractFromCriticalPages } from "@/lib/extractor/extractor";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File;
  if (!file) return new Response("No file uploaded", { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const flatBuffer = await flattenPdf(buffer);

  // Create parse record (temp storage of pdfBuffer)
  const parse = await db.parse.create({
    data: {
      userId,
      fileName: file.name,
      state: "Unknown",
      rawJson: {},
      formatted: {},
      status: "PENDING",
      pdfBuffer: flatBuffer, // ← stored only temporarily
    },
  });

  try {
    // Full pipeline
    const allPages = await renderPdfToPngBase64Array(flatBuffer);
    const { criticalImages, state, criticalPageNumbers } = await classifyCriticalPages(allPages);
    const result = await extractFromCriticalPages(criticalImages);

    const needsReview =
      result.confidence.overall_confidence < 80 ||
      (result.confidence.purchase_price ?? 0) < 90 ||
      (result.confidence.buyer_names ?? 0) < 90 ||
      result.handwriting_detected;

    // FINAL STEP: Save results + DELETE PDF BUFFER IMMEDIATELY AFTER GROK
    await db.parse.update({
      where: { id: parse.id },
      data: {
        state,
        rawJson: result.raw,
        formatted: result.extracted,
        criticalPageNumbers,
        status: needsReview ? "NEEDS_REVIEW" : "COMPLETED",
        finalizedAt: needsReview ? undefined : new Date(),
        pdfBuffer: null, // ← SELF-DESTRUCT: PDF GONE FOREVER
      },
    });

    return Response.json({
      success: true,
      parseId: parse.id,
      needsReview,
      state,
    });
  } catch (error) {
    console.error("Parse pipeline failed:", error);
    await db.parse.delete({ where: { id: parse.id } });
    return new Response("Processing failed", { status: 500 });
  }
}

export const runtime = "edge";
export const maxDuration = 60;