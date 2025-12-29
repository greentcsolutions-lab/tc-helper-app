// src/app/api/parse/cleanup/[parseId]/route.ts
// Version: 3.0.0 - 2025-12-29
// BREAKING: Fixed Issues #3 & #4
// - Preserves high-res ZIP for previews (FIX #3)
// - Clears classificationCache here instead of extract route (FIX #4)

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { del } from "@vercel/blob";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ parseId: string }> }
) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return new Response("Unauthorized", { status: 401 });

  const { parseId } = await params;

  console.log(`\n${"═".repeat(80)}`);
  console.log(`║ 🧹 CLEANUP ROUTE STARTED`);
  console.log(`║ ParseID: ${parseId}`);
  console.log(`${"═".repeat(80)}\n`);

  const parse = await db.parse.findUnique({
    where: { id: parseId },
    select: {
      id: true,
      userId: true,
      lowResZipKey: true,
      highResZipKey: true,
      pdfBuffer: true,
      classificationCache: true,
      user: { select: { clerkId: true } },
    },
  });

  if (!parse) {
    console.error(`[cleanup:${parseId}] ❌ Parse not found`);
    return Response.json({ error: "Parse not found" }, { status: 404 });
  }

  if (parse.user.clerkId !== clerkUserId) {
    console.error(`[cleanup:${parseId}] ❌ Unauthorized access`);
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const cleanupTasks = [];

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 1: Delete Vercel Blob ZIPs (LOW-RES ONLY - FIX #3)
    // ═══════════════════════════════════════════════════════════════════════
    if (parse.lowResZipKey) {
      cleanupTasks.push(
        del(parse.lowResZipKey)
          .then(() => console.log(`[cleanup:${parseId}] ✓ Low-res ZIP deleted from Blob`))
          .catch((err) => console.warn(`[cleanup:${parseId}] ⚠️ Low-res ZIP delete failed:`, err))
      );
    }

    // NOTE: High-res ZIP is PRESERVED for preview endpoint (FIX #3)
    console.log(`[cleanup:${parseId}] ℹ️ Preserving high-res ZIP for preview endpoint`);

    await Promise.allSettled(cleanupTasks);

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 2: Clear temporary DB fields (FIX #4)
    // ═══════════════════════════════════════════════════════════════════════
    console.log(`[cleanup:${parseId}] 🗑️ Clearing temporary DB fields...`);
    
    // Log sizes before cleanup (for debugging)
    if (parse.pdfBuffer) {
      console.log(`[cleanup:${parseId}] pdfBuffer size: ${(parse.pdfBuffer.length / 1024 / 1024).toFixed(2)} MB`);
    }
    if (parse.classificationCache) {
      const cacheStr = JSON.stringify(parse.classificationCache);
      console.log(`[cleanup:${parseId}] classificationCache size: ${(cacheStr.length / 1024 / 1024).toFixed(2)} MB`);
    }

    await db.parse.update({
      where: { id: parseId },
      data: {
        // Binary blob (can be 2-25MB)
        pdfBuffer: null,
        
        // Large JSON with metadata (FIX #4 - now cleared here instead of extract)
        classificationCache: Prisma.JsonNull,
        
        // Low-res ZIP URLs (no longer needed after extraction)
        lowResZipUrl: null,
        lowResZipKey: null,
        
        // PRESERVE high-res ZIP for previews (FIX #3)
        // highResZipUrl: keep!
        // highResZipKey: keep!
        
        // Legacy deprecated fields (for backward compat)
        renderZipUrl: null,
        renderZipKey: null,
      },
    });

    console.log(`[cleanup:${parseId}] ✓ Temporary DB fields cleared`);

    console.log(`\n${"═".repeat(80)}`);
    console.log(`║ ✅ CLEANUP COMPLETE`);
    console.log(`║ ParseID: ${parseId}`);
    console.log(`║ Deleted: pdfBuffer + classificationCache + low-res ZIP`);
    console.log(`║ Preserved: high-res ZIP (for previews)`);
    console.log(`${"═".repeat(80)}\n`);

    return Response.json({
      success: true,
      message: "Temporary files cleaned up",
      clearedFields: [
        "pdfBuffer",
        "classificationCache", 
        "lowResZipUrl",
        "lowResZipKey",
        "renderZipUrl",
        "renderZipKey"
      ],
      preservedFields: [
        "highResZipUrl (for preview endpoint)",
        "highResZipKey"
      ]
    });
  } catch (error: any) {
    console.error(`\n${"═".repeat(80)}`);
    console.error(`║ ❌ CLEANUP FAILED`);
    console.error(`║ ParseID: ${parseId}`);
    console.error(`${"═".repeat(80)}`);
    console.error(`[ERROR]`, error.message);
    console.error(`[ERROR] Stack:`, error.stack);

    return Response.json(
      { error: "Cleanup failed", message: error.message },
      { status: 500 }
    );
  }
}