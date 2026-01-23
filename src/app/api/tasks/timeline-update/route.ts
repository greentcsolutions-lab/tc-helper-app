// src/app/api/tasks/timeline-update/route.ts
// API endpoint for updating timeline tasks directly

import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/prisma';
import { syncTaskToCalendar, archiveTaskInCalendar } from '@/lib/google-calendar/sync';

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

    // Construct timelineEventId from parseId + eventKey
    const timelineEventId = `${parseId}-${timelineEventKey}`;

    // Find the task
    const task = await db.task.findFirst({
      where: {
        parseId,
        timelineEventId,
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

    // Sync changes to Google Calendar automatically
    if (archived === true) {
      // Archive task in calendar
      archiveTaskInCalendar(dbUser.id, task.id).catch((error) => {
        console.error('Failed to archive timeline task in calendar:', error);
      });
    } else {
      // Sync updated task to calendar
      syncTaskToCalendar(dbUser.id, task.id).catch((error) => {
        console.error('Failed to sync timeline task to calendar:', error);
      });
    }

    // Derive timelineEventKey from timelineEventId for response
    const responseEventKey = updatedTask.timelineEventId
      ? updatedTask.timelineEventId.replace(`${parseId}-`, '')
      : timelineEventKey;

    return NextResponse.json({
      success: true,
      task: {
        id: updatedTask.id,
        title: updatedTask.title,
        description: updatedTask.description,
        dueDate: updatedTask.dueDate.toISOString(),
        timelineEventKey: responseEventKey,
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
