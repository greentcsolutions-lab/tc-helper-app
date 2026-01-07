// src/app/api/parse/preview/[parseId]/route.ts
// Version: 3.0.0 - 2026-01-07
// Direct PDF page previews from the original packet stored in Vercel Blob
// - Available as soon as classification completes (pdfPublicUrl + criticalPageNumbers saved)

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ parseId: string }> }
) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return new Response("Unauthorized", { status: 401 });

  const { parseId } = await params;
  const { searchParams } = new URL(request.url);
  const pageParam = searchParams.get("page");

  if (!pageParam) {
    return Response.json({ error: "Missing page parameter" }, { status: 400 });
  }

  const pageNumber = parseInt(pageParam, 10);
  if (isNaN(pageNumber) || pageNumber < 1) {
    return Response.json({ error: "Invalid page number" }, { status: 400 });
  }

  console.log(`[preview:${parseId}] Requesting page ${pageNumber}`);

  const parse = await db.parse.findUnique({
    where: { id: parseId },
    select: {
      id: true,
      userId: true,
      pdfPublicUrl: true,
      criticalPageNumbers: true,
      pageCount: true,
      user: { select: { clerkId: true } },
    },
  });

  if (!parse) {
    console.error(`[preview:${parseId}] Parse not found`);
    return Response.json({ error: "Parse not found" }, { status: 404 });
  }

  if (parse.user.clerkId !== clerkUserId) {
    console.error(`[preview:${parseId}] Unauthorized`);
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  if (!parse.pdfPublicUrl) {
    console.warn(`[preview:${parseId}] PDF not ready yet – classification in progress`);
    return Response.json(
      { error: "Preview not ready – classification in progress" },
      { status: 425 } // Too Early
    );
  }

  if (!parse.pageCount || pageNumber > parse.pageCount) {
    return Response.json({ error: "Page number out of range" }, { status: 400 });
  }

  // Restrict to critical pages only (matches old behaviour)
  if (parse.criticalPageNumbers && !parse.criticalPageNumbers.includes(pageNumber)) {
    return Response.json({ error: "This page is not marked as critical" }, { status: 403 });
  }

  console.log(`[preview:${parseId}] Proxying page ${pageNumber} from original PDF`);

  try {
    const response = await fetch(parse.pdfPublicUrl);

    if (!response.ok || !response.body) {
      throw new Error(`Failed to fetch PDF from Blob: ${response.status}`);
    }

    const headers = new Headers();
    headers.set("Content-Type", "application/pdf");
    headers.set("Cache-Control", "private, max-age=3600");
    headers.set("Accept-Ranges", "bytes"); // Essential for PDF.js to load pages efficiently

    // Forward relevant headers from the Blob response if needed
    // (e.g., Content-Length, ETag – but most are handled automatically)

    return new Response(response.body, {
      status: 200,
      headers,
    });
  } catch (error: any) {
    console.error(`[preview:${parseId}] Error proxying PDF:`, error);
    return Response.json({ error: "Failed to load PDF page" }, { status: 500 });
  }
}