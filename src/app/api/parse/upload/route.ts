// src/app/api/parse/upload/route.ts
// REFACTORED: Just validates, stores PDF, returns parseId

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { put } from "@vercel/blob"; 

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

  // Upload first: ensures we only create DB record when storage succeeded
  let pdfPublicUrl: string | undefined;
  try {
    console.log("[upload] Uploading to Vercel Blob...");
    const res = await put(`uploads/${Date.now()}-${file.name}`, buffer, {
      access: "public",
      addRandomSuffix: true,
    });

    pdfPublicUrl = (res as any)?.url;
    if (!pdfPublicUrl) {
      console.error("[upload] Vercel put returned empty URL");
      return Response.json({ success: false, error: "Blob upload returned empty URL" }, { status: 500 });
    }

    console.log(`[upload] Uploaded PDF to Vercel Blob: ${pdfPublicUrl}`);
  } catch (uploadErr: any) {
    console.error("[upload] Vercel blob upload failed:", uploadErr);
    return Response.json({ success: false, error: String(uploadErr) }, { status: 500 });
  }

  // Create parse record only after successful upload
  try {
    const parse = await db.parse.create({
      data: {
        userId: user.id,
        fileName: file.name,
        state: "Unknown",
        status: "UPLOADED",
        pdfBuffer: buffer,
        pdfPublicUrl,
        rawJson: {},
        formatted: {},
        criticalPageNumbers: [],
      },
    });

    console.log(`[upload] Created parse ${parse.id} - ready for processing (pdfPublicUrl persisted)`);
    return Response.json({
      success: true,
      parseId: parse.id,
      pdfPublicUrl,
      message: "Upload complete - PDF stored and ready for classification",
    });
  } catch (dbErr: any) {
    // Optionally: attempt to delete the uploaded blob to avoid orphaned files (not implemented here)
    console.error("[upload] DB create failed after successful upload:", dbErr);
    return Response.json({ success: false, error: "Failed to create parse record after upload" }, { status: 500 });
  }
}
