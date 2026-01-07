// src/app/api/parse/cleanup/[parseId]/route.ts
// Version: 2.1.0 - 2026-01-07
// UPDATED: Now also clears pdfPublicUrl (temporary public Blob URL for direct Mistral calls)
// UPDATED: Removed legacy dual-DPI fields (no longer used after direct-PDF migration)

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { del } from "@vercel/blob";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ parseId: string }> }
) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return new Response("Unauthorized", { status: 401 });

  const { parseId } = await params;

  try {
    console.log(`[cleanup] START parseId=${parseId}`);

    // Fetch parse with temporary storage fields
    const parse = await db.parse.findUnique({
      where: { id: parseId },
      select: {
        id: true,
        userId: true,
        user: { select: { clerkId: true } },
        
        // NEW: Temporary public PDF URL for direct Mistral calls
        pdfPublicUrl: true,
        
        // LEGACY: Render ZIP fields (kept only for older parses)
        renderZipKey: true,
        lowResZipKey: true,
        highResZipKey: true,
        
        // Other temporary data
        pdfBuffer: true,
        classificationCache: true,
      },
    });

    if (!parse) {
      console.error(`[cleanup] Parse not found: ${parseId}`);
      return Response.json({ error: "Parse not found" }, { status: 404 });
    }

    if (parse.user.clerkId !== clerkUserId) {
      console.error(`[cleanup] Unauthorized access attempt by ${clerkUserId}`);
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    const deletions: string[] = [];
    const errors: string[] = [];

    // =========================================================================
    // NEW: Delete temporary public PDF Blob (used for direct Mistral classify/extract)
    // =========================================================================
    if (parse.pdfPublicUrl) {
      try {
        // Extract the key/path from the public URL
        // Vercel Blob URLs are in format: https://<random>.public.blob.vercel-storage.com/<pathname>
        const url = new URL(parse.pdfPublicUrl);
        const key = url.pathname.slice(1); // remove leading slash

        console.log(`[cleanup] Deleting temporary public PDF Blob: ${key}`);
        await del(key);
        deletions.push("pdfPublicUrl");
        console.log(`[cleanup] ✓ Deleted temporary public PDF`);
      } catch (error: any) {
        console.error(`[cleanup] Failed to delete pdfPublicUrl:`, error);
        errors.push(`pdfPublicUrl: ${error.message}`);
      }
    }

    // =========================================================================
    // LEGACY: Delete any remaining render ZIPs (for backward compatibility)
    // =========================================================================
    if (parse.renderZipKey) {
      try {
        console.log(`[cleanup] Deleting render ZIP: ${parse.renderZipKey}`);
        await del(parse.renderZipKey);
        deletions.push("renderZip");
      } catch (error: any) {
        console.error(`[cleanup] Failed to delete renderZipKey:`, error);
        errors.push(`renderZip: ${error.message}`);
      }
    }

    if (parse.lowResZipKey) {
      try {
        console.log(`[cleanup] Deleting legacy low-res ZIP: ${parse.lowResZipKey}`);
        await del(parse.lowResZipKey);
        deletions.push("lowResZip");
      } catch (error: any) {
        console.error(`[cleanup] Failed to delete lowResZipKey:`, error);
        errors.push(`lowResZip: ${error.message}`);
      }
    }

    if (parse.highResZipKey) {
      try {
        console.log(`[cleanup] Deleting legacy high-res ZIP: ${parse.highResZipKey}`);
        await del(parse.highResZipKey);
        deletions.push("highResZip");
      } catch (error: any) {
        console.error(`[cleanup] Failed to delete highResZipKey:`, error);
        errors.push(`highResZip: ${error.message}`);
      }
    }

    // =========================================================================
    // DATABASE CLEANUP: Remove all temporary data
    // =========================================================================
    console.log(`[cleanup] Clearing temporary database fields...`);

    await db.parse.update({
      where: { id: parseId },
      data: {
        // NEW: Clear temporary public PDF URL
        pdfPublicUrl: null,
        
        // Legacy render fields (for older parses)
        renderZipUrl: null,
        renderZipKey: null,
        lowResZipUrl: null,
        lowResZipKey: null,
        highResZipUrl: null,
        highResZipKey: null,
        
        // Other temporary data
        pdfBuffer: null,
        classificationCache: Prisma.DbNull, // JSON field → use DbNull
      },
    });

    console.log(`[cleanup] ✓ Database fields cleared`);

    // =========================================================================
    // SUMMARY
    // =========================================================================
    const summary = {
      success: true,
      deletedFromBlob: deletions,
      errors: errors.length > 0 ? errors : undefined,
      clearedFromDB: [
        "pdfPublicUrl",
        "renderZipUrl/Key",
        "lowResZipUrl/Key",
        "highResZipUrl/Key",
        "pdfBuffer",
        "classificationCache",
      ],
    };

    console.log(`[cleanup] COMPLETE — Deleted ${deletions.length} blob(s), ${errors.length} error(s)`);
    console.log(`[cleanup] Summary:`, JSON.stringify(summary, null, 2));

    return Response.json(summary);
  } catch (error: any) {
    console.error(`[cleanup] ERROR:`, error);
    return Response.json(
      { error: error.message || "Cleanup failed" },
      { status: 500 }
    );
  }
}