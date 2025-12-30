// src/app/api/parse/preview/[parseId]/route.ts
// Version: 1.0.0 - 2025-12-29
// NEW: Preview endpoint for critical page thumbnails (FIX #3)
// Uses high-res ZIP + identified critical pages for previews 

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ parseId: string }> }
) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return new Response("Unauthorized", { status: 401 });

  const { parseId } = await params;

  console.log(`[preview:${parseId}] Fetching preview data...`);

  const parse = await db.parse.findUnique({
    where: { id: parseId },
    select: {
      id: true,
      userId: true,
      highResZipUrl: true,       // FIX #3: Use high-res ZIP for previews
      criticalPageNumbers: true,
      pageCount: true,
      user: { select: { clerkId: true } },
    },
  });

  if (!parse) {
    console.error(`[preview:${parseId}] ❌ Parse not found`);
    return Response.json({ error: "Parse not found" }, { status: 404 });
  }

  if (parse.user.clerkId !== clerkUserId) {
    console.error(`[preview:${parseId}] ❌ Unauthorized access`);
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  if (!parse.highResZipUrl) {
    console.warn(`[preview:${parseId}] ⚠️ High-res ZIP not available (may have been cleaned up)`);
    return Response.json({ 
      error: "Preview not available - files may have been cleaned up",
      hint: "Previews are only available during extraction. After cleanup, preview ZIPs are deleted to save storage."
    }, { status: 410 });  // 410 Gone
  }

  console.log(`[preview:${parseId}] ✓ Returning preview data:`);
  console.log(`[preview:${parseId}]   ZIP URL: ${parse.highResZipUrl}`);
  console.log(`[preview:${parseId}]   Critical pages: [${parse.criticalPageNumbers?.join(', ') || 'none'}]`);
  console.log(`[preview:${parseId}]   Total pages: ${parse.pageCount || 'unknown'}`);

  return Response.json({
    success: true,
    zipUrl: parse.highResZipUrl,
    criticalPageNumbers: parse.criticalPageNumbers || [],
    totalPages: parse.pageCount,
    note: "This ZIP will be deleted after cleanup to save storage. Download critical pages during extraction if needed."
  });
}