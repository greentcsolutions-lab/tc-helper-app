// src/app/api/parse/bulk-delete/route.ts
// Delete multiple transactions and their associated Blob files

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { del } from "@vercel/blob";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const body = await request.json();
    const { ids } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return Response.json(
        { error: "Invalid request: ids must be a non-empty array" },
        { status: 400 }
      );
    }

    // Find the user
    const user = await db.user.findUnique({
      where: { clerkId: clerkUserId },
      select: { id: true },
    });

    if (!user) {
      return new Response("User not found", { status: 404 });
    }

    // Find all parses and verify ownership
    const parses = await db.parse.findMany({
      where: {
        id: { in: ids },
        userId: user.id,
      },
      select: {
        id: true,
        renderZipKey: true,
        status: true,
      },
    });

    if (parses.length !== ids.length) {
      return Response.json(
        { error: "Some transactions not found or unauthorized" },
        { status: 403 }
      );
    }

    // Delete Blob files in parallel
    const blobDeletions = parses
      .filter(p => p.renderZipKey)
      .map(async (parse) => {
        try {
          await del(parse.renderZipKey!);
          console.log(`[bulk-delete] Deleted Blob file: ${parse.renderZipKey}`);
        } catch (err) {
          console.warn(`[bulk-delete] Blob delete failed (may not exist):`, err);
        }
      });

    await Promise.allSettled(blobDeletions);

    // Delete from database and decrement user usage counter
    await db.$transaction(async (tx) => {
      // Count how many are non-archived (active) before deletion
      const activeCount = parses.filter(p => p.status !== "ARCHIVED").length;

      // Delete all parses
      await tx.parse.deleteMany({
        where: {
          id: { in: ids },
          userId: user.id,
        },
      });

      // Decrement the user's parse counter for active (non-archived) parses only
      if (activeCount > 0) {
        const usage = await tx.userUsage.findUnique({
          where: { userId: user.id },
        });

        if (usage) {
          await tx.userUsage.update({
            where: { userId: user.id },
            data: {
              parses: Math.max(0, usage.parses - activeCount),
            },
          });
          console.log(`[bulk-delete] Decremented user usage counter by ${activeCount} (from ${usage.parses} to ${Math.max(0, usage.parses - activeCount)})`);
        }
      }
    });

    console.log(`[bulk-delete] ✓ Deleted ${ids.length} transaction(s)`);

    return Response.json({
      success: true,
      message: `${ids.length} transaction(s) deleted successfully`,
      count: ids.length,
    });
  } catch (error: any) {
    console.error("[bulk-delete] Failed:", error);
    return Response.json(
      { error: "Bulk delete failed", message: error.message },
      { status: 500 }
    );
  }
}
