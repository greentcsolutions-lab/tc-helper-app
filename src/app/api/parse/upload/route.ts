// src/app/api/parse/upload/route.ts
// REFACTORED: Just validates, stores PDF, returns parseId
// Processing happens in /api/parse/process/[parseId] via SSE

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return new Response("Unauthorized", { status: 401 });

  const user = await db.user.findUnique({
    where: { clerkId: clerkUserId },
    select: { id: true, credits: true },
  });

  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  if (user.credits < 1) {
    return Response.json({ error: "No credits remaining" }, { status: 402 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File;
  if (!file) return Response.json({ error: "No file" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());

  // Validate PDF
  if (!buffer.subarray(0, 8).toString().includes("%PDF")) {
    return Response.json({ error: "invalid_pdf" }, { status: 400 });
  }
  if (buffer.length > 25_000_000) {
    return Response.json({ error: "File too large – max 25 MB" }, { status: 400 });
  }

  console.log(`[upload] Received ${file.name} (${(buffer.length / 1e6).toFixed(1)} MB)`);

  // Create parse record
  const parse = await db.parse.create({
    data: {
      userId: user.id,
      fileName: file.name,
      state: "Unknown",
      status: "PENDING", // ← waiting for processing
      pdfBuffer: buffer,
      rawJson: {},
      formatted: {},
      criticalPageNumbers: [],
    },
  });

  console.log(`[upload] Created parse ${parse.id} - ready for processing`);

  // Return immediately - client will connect to SSE endpoint
  return Response.json({
    success: true,
    parseId: parse.id,
    message: "Upload complete - starting AI analysis...",
  });
}
