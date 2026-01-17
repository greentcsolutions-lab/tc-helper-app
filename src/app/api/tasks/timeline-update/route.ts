// src/app/api/tasks/timeline-update/route.ts
// API endpoint for updating timeline tasks directly

import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/prisma';
import { syncTimelineEventsToCalendar } from '@/lib/google-calendar/sync-timeline-events';

/**
 * PATCH /api/tasks/timeline-update
 * Updates a timeline task's due date and other properties
 * This is the DIRECT route for timeline edits (no Parse model intermediary)
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dbUser = await db.user.findUnique({
      where: { clerkId: user.id },
      select: { id: true },
    });

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { parseId, timelineEventKey, dueDate, archived } = body;

    // Validation
    if (!parseId || !timelineEventKey) {
      return NextResponse.json(
        { error: 'parseId and timelineEventKey are required' },
        { status: 400 }
      );
    }

    // Find the task
    const task = await db.task.findFirst({
      where: {
        parseId,
        timelineEventKey,
        userId: dbUser.id,
      },
    });

    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // Build update object
    const updateData: any = {};

    // Update due date if provided
    if (dueDate !== undefined && dueDate !== null) {
      // Convert date string to Date object
      // Input should be YYYY-MM-DD format
      const dateStr = dueDate.split('T')[0]; // Ensure we only have date part
      updateData.dueDate = new Date(dateStr + 'T00:00:00.000Z'); // UTC midnight
      console.log(`[timeline-update] Task ${task.id} (${timelineEventKey}): dueDate → ${updateData.dueDate.toISOString()}`);
    }

    // Update archived status if provided (for waived events)
    if (archived !== undefined) {
      updateData.archived = archived;
      console.log(`[timeline-update] Task ${task.id} (${timelineEventKey}): archived → ${archived}`);
    }

    // Update the task
    const updatedTask = await db.task.update({
      where: { id: task.id },
      data: updateData,
    });

    console.log(`[timeline-update] Successfully updated task ${task.id} for ${timelineEventKey}`);

    // Trigger Google Calendar sync in background
    syncTimelineEventsToCalendar(parseId, dbUser.id).catch((error) => {
      console.error('Failed to sync to calendar after timeline update:', error);
    });

    return NextResponse.json({
      success: true,
      task: {
        id: updatedTask.id,
        title: updatedTask.title,
        description: updatedTask.description,
        dueDate: updatedTask.dueDate.toISOString(),
        timelineEventKey: updatedTask.timelineEventKey,
        status: updatedTask.status,
        archived: updatedTask.archived,
      },
    });
  } catch (error) {
    console.error('Error updating timeline task:', error);
    return NextResponse.json(
      { error: 'Failed to update timeline task' },
      { status: 500 }
    );
  }
}
