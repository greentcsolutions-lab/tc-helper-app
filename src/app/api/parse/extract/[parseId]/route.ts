// src/app/api/parse/extract/[parseId]/route.ts
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { renderPdfToPngBase64Array } from "@/lib/extractor/renderer";
import { extractFromCriticalPages } from "@/lib/extractor/extractor";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  context: { params: { parseId: string } }
) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const parseId = context.params.parseId;

  const parse = await db.parse.findUnique({
    where: { id: parseId, userId },
    select: { pdfBuffer: true, criticalPageNumbers: true, status: true },
  });

  if (!parse || parse.status !== "READY_FOR_EXTRACT" || !parse.pdfBuffer) {
    return new Response("Invalid parse", { status: 400 });
  }

  const allPages = await renderPdfToPngBase64Array(parse.pdfBuffer);
  const criticalImages = allPages.filter(p =>
    parse.criticalPageNumbers.includes(p.pageNumber)
  );
  const result = await extractFromCriticalPages(criticalImages);

  const needsReview =
    result.confidence.overall_confidence < 80 ||
    (result.confidence.purchase_price ?? 0) < 90 ||
    result.handwriting_detected;

  await db.parse.update({
    where: { id: parseId },
    data: {
      rawJson: result.raw,
      formatted: result.extracted,
      status: needsReview ? "NEEDS_REVIEW" : "COMPLETED",
      finalizedAt: needsReview ? undefined : new Date(),
      pdfBuffer: null,
    },
  });

  return Response.json({ success: true, needsReview, extracted: result.extracted });
}