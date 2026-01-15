// src/app/api/tasks/bulk-delete/route.ts
// API endpoint for bulk deleting tasks

import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/prisma';
import { deleteTaskFromCalendar } from '@/lib/google-calendar/sync';

/**
 * POST /api/tasks/bulk-delete
 * Delete multiple tasks at once
 */
export async function POST(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user from database
    const dbUser = await db.user.findUnique({
      where: { clerkId: user.id },
      select: { id: true },
    });

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { taskIds } = body;

    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return NextResponse.json({ error: 'Invalid task IDs' }, { status: 400 });
    }

    // Verify all tasks belong to user and get their isCustom status
    const tasks = await db.task.findMany({
      where: {
        id: { in: taskIds },
        userId: dbUser.id,
      },
      select: { id: true, isCustom: true },
    });

    if (tasks.length !== taskIds.length) {
      return NextResponse.json({ error: 'Some tasks not found' }, { status: 404 });
    }

    // Delete from Google Calendar (async, don't wait)
    tasks.forEach((task) => {
      deleteTaskFromCalendar(dbUser.id, task.id).catch((error) => {
        console.error(`Failed to delete task ${task.id} from calendar:`, error);
      });
    });

    // Count custom tasks being deleted
    const customTasksCount = tasks.filter((t) => t.isCustom).length;

    // Delete all tasks and update custom task count in a transaction
    await db.$transaction(async (tx) => {
      await tx.task.deleteMany({
        where: {
          id: { in: taskIds },
        },
      });

      // Decrement custom task count if any custom tasks were deleted
      if (customTasksCount > 0) {
        await tx.user.update({
          where: { id: dbUser.id },
          data: { customTaskCount: { decrement: customTasksCount } },
        });
      }
    });

    return NextResponse.json({
      success: true,
      deletedCount: tasks.length,
    });
  } catch (error) {
    console.error('Error bulk deleting tasks:', error);
    return NextResponse.json(
      { error: 'Failed to delete tasks' },
      { status: 500 }
    );
  }
}
