// src/app/api/parse/finalize/[parseId]/route.ts
// Version: 2.0.0 - 2025-12-29
// BREAKING: Removed lowResZipUrl (FIX #3 - now using dedicated preview endpoint)

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 300;

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
      extractionDetails: true,     // contains route + field provenance (FIX #2)
      timelineEvents: true,

      // === FOR REVIEW FLAGS ===
      criticalPageNumbers: true,   // used by preview endpoint

      // === DEBUG / METADATA (optional but helpful) ===
      rawJson: true,
      missingSCOs: true,
      
      // REMOVED: lowResZipUrl (FIX #3 - use /api/parse/preview/:id instead)
      // Client should call preview endpoint separately if previews are needed
    },
  });

  if (!parse) {
    return new Response("Parse not found or access denied", { status: 404 });
  }

  return Response.json({
    success: true,
    data: parse,
    previewEndpoint: `/api/parse/preview/${parseId}`,  // FIX #3: Point to new endpoint
  });
}