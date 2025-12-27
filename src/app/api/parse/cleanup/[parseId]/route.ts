// src/app/api/parse/cleanup/[parseId]/route.ts
// Version: 2.0.0 - 2025-12-27
// Deletes temporary render artifacts (ZIPs) and clears temporary DB fields after extraction

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { del } from "@vercel/blob";

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

    // Delete low-res ZIP from Vercel Blob
    if (parse.lowResZipKey) {
      cleanupTasks.push(
        del(parse.lowResZipKey)
          .then(() => console.log(`[cleanup:${parseId}] ✓ Low-res ZIP deleted`))
          .catch((err) => console.warn(`[cleanup:${parseId}] ⚠️ Low-res ZIP delete failed:`, err))
      );
    }

    // Delete high-res ZIP from Vercel Blob
    if (parse.highResZipKey) {
      cleanupTasks.push(
        del(parse.highResZipKey)
          .then(() => console.log(`[cleanup:${parseId}] ✓ High-res ZIP deleted`))
          .catch((err) => console.warn(`[cleanup:${parseId}] ⚠️ High-res ZIP delete failed:`, err))
      );
    }

    // Clear temporary fields from database
    cleanupTasks.push(
      db.parse.update({
        where: { id: parseId },
        data: {
          pdfBuffer: null,
          lowResZipUrl: null,
          lowResZipKey: null,
          highResZipUrl: null,
          highResZipKey: null,
          // Keep deprecated fields null too for consistency
          renderZipUrl: null,
          renderZipKey: null,
        },
      })
        .then(() => console.log(`[cleanup:${parseId}] ✓ Temporary DB fields cleared`))
        .catch((err) => console.error(`[cleanup:${parseId}] ❌ DB update failed:`, err))
    );

    await Promise.allSettled(cleanupTasks);

    console.log(`\n${"═".repeat(80)}`);
    console.log(`║ ✅ CLEANUP COMPLETE`);
    console.log(`║ ParseID: ${parseId}`);
    console.log(`${"═".repeat(80)}\n`);

    return Response.json({
      success: true,
      message: "All temporary files and data deleted",
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