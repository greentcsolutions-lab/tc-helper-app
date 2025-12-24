// src/app/api/parse/finalize/[parseId]/route.ts
// Version: 1.0.1-secure-params-fix - 2025-12-24
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 300;

// Fixed for Next.js 15 — params is now a Promise
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ parseId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { parseId } = await params;

  // Find the user's parse record
  const parse = await db.parse.findUnique({
    where: { 
      id: parseId,
      // Security: ensure it belongs to the authenticated user
      user: { clerkId: userId }
    },
    select: {
      id: true,
      fileName: true,
      status: true,
      createdAt: true,
      finalizedAt: true,

      // === UNIVERSAL CORE FIELDS (these are what the frontend displays) ===
      buyerNames: true,
      sellerNames: true,
      propertyAddress: true,
      purchasePrice: true,
      earnestMoneyAmount: true,
      earnestMoneyHolder: true,
      closingDate: true,
      effectiveDate: true,
      isAllCash: true,
      loanType: true,

      // === RICH / STATE-SPECIFIC DATA ===
      extractionDetails: true,     // contains route + future california/tx/fl rich object
      timelineEvents: true,

      // === FOR THUMBNAIL GRID & REVIEW ===
      lowResZipUrl: true,          // low-DPI render zip for page previews
      criticalPageNumbers: true,   // if you want to highlight critical pages

      // === DEBUG / METADATA (optional but helpful) ===
      rawJson: true,
      missingSCOs: true,
    },
  });

  if (!parse) {
    return new Response("Parse not found or access denied", { status: 404 });
  }

  return Response.json({
    success: true,
    data: parse,
  });
}