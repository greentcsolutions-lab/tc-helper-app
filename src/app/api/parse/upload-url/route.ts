// src/app/api/parse/upload-url/route.ts
// Version: 1.0.0 - 2026-01-30
// Generates signed URLs for direct client-to-Blob uploads
// Bypasses serverless function body size limits

import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        console.log(`[upload-url] Generating signed URL for: ${pathname}`);

        // Optional: Add additional validation here
        // (e.g., check user quota/credits before allowing upload)

        return {
          allowedContentTypes: ["application/pdf"],
          tokenPayload: JSON.stringify({
            userId: clerkUserId,
            uploadedAt: new Date().toISOString(),
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log(`[upload-url] Upload completed: ${blob.url}`);
        
        // Optional: Track upload in database
        // const payload = JSON.parse(tokenPayload || "{}");
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error: any) {
    console.error("[upload-url] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate upload URL" },
      { status: 500 }
    );
  }
}
