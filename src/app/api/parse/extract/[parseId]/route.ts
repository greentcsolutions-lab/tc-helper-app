// src/app/api/parse/extract/[parseId]/route.ts
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { renderPdfToPngBase64Array } from "@/lib/extractor/renderer";
import { extractFromCriticalPages } from "@/lib/extractor/extractor";

export async function POST(req: NextRequest, { params }: { params: { parseId: string } }) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const parse = await db.parse.findUnique({
    where: { id: params.parseId, userId },  // Auth check
    select: { pdfBuffer: true, criticalPageNumbers: true, status: true },
  });

  if (!parse || parse.status !== "READY_FOR_EXTRACT" || !parse.pdfBuffer) {
    return new Response("Invalid parse", { status: 400 });
  }

  // Re-render only critical pages (efficient)
  const allPages = await renderPdfToPngBase64Array(parse.pdfBuffer);
  const criticalImages = allPages.filter(p => parse.criticalPageNumbers.includes(p.pageNumber));
  const result = await extractFromCriticalPages(criticalImages);

  const needsReview = /* your confidence logic here, e.g. */
    result.confidence.overall_confidence < 80 ||
    (result.confidence.purchase_price ?? 0) < 90 ||
    result.handwriting_detected;

  // Save + nuke PDF
  await db.parse.update({
    where: { id: params.parseId },
    data: {
      rawJson: result.raw,
      formatted: result.extracted,
      status: needsReview ? "NEEDS_REVIEW" : "COMPLETED",
      finalizedAt: needsReview ? undefined : new Date(),
      pdfBuffer: null,  // ← Delete now
    },
  });

  return Response.json({ success: true, needsReview, extracted: result.extracted });
}

export const runtime = "nodejs";
export const maxDuration = 60;