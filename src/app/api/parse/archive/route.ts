// src/app/api/parse/archive/route.ts
// Archive multiple transactions (sets status to ARCHIVED)

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { archiveTaskInCalendar } from "@/lib/google-calendar/sync";

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

    // Get all tasks that will be archived (need IDs before transaction)
    const tasksToArchive = await db.task.findMany({
      where: {
        parseId: { in: ids },
        userId: user.id,
      },
      select: { id: true },
    });

    // Archive transactions and associated tasks
    await db.$transaction(async (tx) => {
      // Verify all parses belong to this user and count how many are currently non-archived
      const parses = await tx.parse.findMany({
        where: {
          id: { in: ids },
          userId: user.id,
        },
        select: {
          id: true,
          status: true,
          archived: true,
        },
      });

      if (parses.length !== ids.length) {
        throw new Error("Some transactions not found or unauthorized");
      }

      // Count how many are being archived (currently non-archived)
      const countToDecrement = parses.filter(p => !p.archived).length;

      // Update all to ARCHIVED status and set archived flag
      await tx.parse.updateMany({
        where: {
          id: { in: ids },
          userId: user.id,
        },
        data: {
          status: "ARCHIVED",
          archived: true,
        },
      });

      // Also mark all tasks associated with these parses as archived
      await tx.task.updateMany({
        where: {
          parseId: { in: ids },
          userId: user.id,
        },
        data: {
          archived: true,
        },
      });

      console.log(`[archive] ✓ Archived ${ids.length} transaction(s) and their associated tasks`);

      // Decrement the user's parse counter (cannot go below 0)
      if (countToDecrement > 0) {
        const usage = await tx.userUsage.findUnique({
          where: { userId: user.id },
        });

        if (usage) {
          await tx.userUsage.update({
            where: { userId: user.id },
            data: {
              parses: Math.max(0, usage.parses - countToDecrement),
            },
          });
          console.log(`[archive] Decremented user usage counter by ${countToDecrement} (from ${usage.parses} to ${Math.max(0, usage.parses - countToDecrement)})`);
        }
      }
    });

    // Remove archived tasks from Google Calendar (async, don't block response)
    tasksToArchive.forEach((task) => {
      archiveTaskInCalendar(user.id, task.id).catch((error) => {
        console.error(`Failed to archive task ${task.id} in calendar:`, error);
      });
    });

    console.log(`[archive] ✓ Archived ${ids.length} transaction(s)`);

    return Response.json({
      success: true,
      message: `${ids.length} transaction(s) archived successfully`,
      count: ids.length,
    });
  } catch (error: any) {
    console.error("[archive] Failed:", error);
    return Response.json(
      { error: "Archive failed", message: error.message },
      { status: 500 }
    );
  }
}
