// src/app/api/parse/delete/[parseId]/route.ts
// Version: 1.0.0
// Deletes a parse and all associated data (including Blob files)

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { del } from "@vercel/blob";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ parseId: string }> }
) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { parseId } = await params;

  // Find the parse and verify ownership
  const parse = await db.parse.findUnique({
    where: { id: parseId },
    select: {
      id: true,
      userId: true,
      renderZipKey: true,
      user: {
        select: {
          clerkId: true,
        },
      },
    },
  });

  if (!parse) {
    return Response.json({ error: "Parse not found" }, { status: 404 });
  }

  // Verify the user owns this parse
  if (parse.user.clerkId !== clerkUserId) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    // Delete from Vercel Blob if exists
    if (parse.renderZipKey) {
      try {
        await del(parse.renderZipKey);
        console.log(`[delete:${parseId}] Deleted Blob file: ${parse.renderZipKey}`);
      } catch (err) {
        console.warn(`[delete:${parseId}] Blob delete failed (may not exist):`, err);
      }
    }

    // Delete from database and decrement user usage counter
    await db.$transaction(async (tx) => {
      // Delete the parse
      await tx.parse.delete({
        where: { id: parseId },
      });

      // Decrement the user's parse counter (cannot go below 0)
      const usage = await tx.userUsage.findUnique({
        where: { userId: parse.userId },
      });

      if (usage) {
        await tx.userUsage.update({
          where: { userId: parse.userId },
          data: {
            parses: Math.max(0, usage.parses - 1),
          },
        });
        console.log(`[delete:${parseId}] Decremented user usage counter from ${usage.parses} to ${Math.max(0, usage.parses - 1)}`);
      }
    });

    console.log(`[delete:${parseId}] ✓ Parse deleted successfully`);

    return Response.json({
      success: true,
      message: "Transaction deleted successfully",
    });
  } catch (error: any) {
    console.error(`[delete:${parseId}] Failed:`, error);
    return Response.json(
      { error: "Delete failed", message: error.message },
      { status: 500 }
    );
  }
}
