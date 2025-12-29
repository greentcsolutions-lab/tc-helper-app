// src/app/api/parse/cleanup/[parseId]/route.ts
// Version: 2.1.0 - 2025-12-29
// FIXED: Now clears ALL temporary DB fields including pdfBuffer and classificationCache
// Deletes temporary render artifacts (ZIPs) and clears ALL temporary DB fields after extraction

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
    // STEP 1: Delete Vercel Blob ZIPs
    // ═══════════════════════════════════════════════════════════════════════
    if (parse.lowResZipKey) {
      cleanupTasks.push(
        del(parse.lowResZipKey)
          .then(() => console.log(`[cleanup:${parseId}] ✓ Low-res ZIP deleted from Blob`))
          .catch((err) => console.warn(`[cleanup:${parseId}] ⚠️ Low-res ZIP delete failed:`, err))
      );
    }

    if (parse.highResZipKey) {
      cleanupTasks.push(
        del(parse.highResZipKey)
          .then(() => console.log(`[cleanup:${parseId}] ✓ High-res ZIP deleted from Blob`))
          .catch((err) => console.warn(`[cleanup:${parseId}] ⚠️ High-res ZIP delete failed:`, err))
      );
    }

    await Promise.allSettled(cleanupTasks);

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 2: Clear ALL temporary fields from database
    // ═══════════════════════════════════════════════════════════════════════
    // This is the critical fix - we need to explicitly set large fields to JsonNull
    
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
        
        // Large JSON with base64 images (can be 10-20MB)
        classificationCache: Prisma.JsonNull,
        
        // ZIP URLs (small but no longer needed)
        lowResZipUrl: null,
        lowResZipKey: null,
        highResZipUrl: null,
        highResZipKey: null,
        
        // Legacy deprecated fields (for backward compat)
        renderZipUrl: null,
        renderZipKey: null,
      },
    });

    console.log(`[cleanup:${parseId}] ✓ All temporary DB fields cleared`);

    console.log(`\n${"═".repeat(80)}`);
    console.log(`║ ✅ CLEANUP COMPLETE`);
    console.log(`║ ParseID: ${parseId}`);
    console.log(`║ Freed up: pdfBuffer + classificationCache + ZIP URLs`);
    console.log(`${"═".repeat(80)}\n`);

    return Response.json({
      success: true,
      message: "All temporary files and data deleted",
      clearedFields: [
        "pdfBuffer",
        "classificationCache", 
        "lowResZipUrl",
        "lowResZipKey",
        "highResZipUrl", 
        "highResZipKey",
        "renderZipUrl",
        "renderZipKey"
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