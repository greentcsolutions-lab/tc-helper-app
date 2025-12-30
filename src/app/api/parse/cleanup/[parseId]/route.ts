// src/app/api/parse/cleanup/[parseId]/route.ts
// Version: 2.0.1 - 2025-12-30
// FIXED: Prisma null handling for JSON fields (use Prisma.DbNull instead of null)
// UPDATED: Cleanup for single 200 DPI architecture

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

    // Fetch parse with all temporary storage fields
    const parse = await db.parse.findUnique({
      where: { id: parseId },
      select: {
        id: true,
        userId: true,
        user: { select: { clerkId: true } },
        
        // NEW: Universal 200 DPI fields
        renderZipKey: true,
        
        // LEGACY: Dual-DPI fields (for backward compatibility)
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
    // NEW ARCHITECTURE: Delete universal 200 DPI ZIP
    // =========================================================================
    if (parse.renderZipKey) {
      try {
        console.log(`[cleanup] Deleting universal 200 DPI ZIP: ${parse.renderZipKey}`);
        await del(parse.renderZipKey);
        deletions.push("renderZip");
        console.log(`[cleanup] ✓ Deleted universal 200 DPI ZIP`);
      } catch (error: any) {
        console.error(`[cleanup] Failed to delete renderZipKey:`, error);
        errors.push(`renderZip: ${error.message}`);
      }
    }

    // =========================================================================
    // LEGACY ARCHITECTURE: Delete dual-DPI ZIPs (for backward compatibility)
    // =========================================================================
    if (parse.lowResZipKey) {
      try {
        console.log(`[cleanup] Deleting legacy low-res ZIP: ${parse.lowResZipKey}`);
        await del(parse.lowResZipKey);
        deletions.push("lowResZip");
        console.log(`[cleanup] ✓ Deleted legacy low-res ZIP`);
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
        console.log(`[cleanup] ✓ Deleted legacy high-res ZIP`);
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
        // NEW: Clear universal 200 DPI fields
        renderZipUrl: null,
        renderZipKey: null,
        
        // LEGACY: Clear dual-DPI fields
        lowResZipUrl: null,
        lowResZipKey: null,
        highResZipUrl: null,
        highResZipKey: null,
        
        // Clear other temporary data
        pdfBuffer: null,
        classificationCache: Prisma.DbNull, // FIXED: Use Prisma.DbNull for JSON fields
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
        "renderZipUrl/Key",
        "lowResZipUrl/Key", 
        "highResZipUrl/Key",
        "pdfBuffer",
        "classificationCache"
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