// src/app/api/parse/extract/[parseId]/route.ts
// ← ONLY CHANGE: Added Clerk → CUID lookup at the top

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { renderPdfToPngBase64Array } from "@/lib/pdf/renderer-s3";
import { extractFromCriticalPages } from "@/lib/extractor/extractor";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ parseId: string }> }
) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return new Response("Unauthorized", { status: 401 });

  // ← THIS IS THE ONLY NEW CODE (fixes 400 error)
  const user = await db.user.findUnique({
    where: { clerkId: clerkUserId },
    select: { id: true },
  });

  if (!user) {
    return new Response("User not found", { status: 404 });
  }
  // ← END OF NEW CODE

  const { parseId } = await params;

  const parse = await db.parse.findUnique({
    where: { id: parseId, userId: user.id },  // ← Now using correct CUID
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