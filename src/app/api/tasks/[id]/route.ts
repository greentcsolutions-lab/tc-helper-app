// src/app/api/tasks/[id]/route.ts
// API routes for individual task operations

import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/prisma';
import { TASK_STATUS } from '@/types/task';
import { syncTaskToCalendar, deleteTaskFromCalendar, archiveTaskInCalendar } from '@/lib/google-calendar/sync';
import { syncTaskToTimeline } from '@/lib/tasks/sync-timeline-tasks';

/**
 * PATCH /api/tasks/[id]
 * Update a task
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { id } = params;
    const body = await request.json();

    // Verify task belongs to user
    const task = await db.task.findUnique({
      where: { id },
      select: { userId: true, status: true },
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    if (task.userId !== dbUser.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Prepare update data
    const updateData: any = {};

    if (body.status !== undefined) {
      updateData.status = body.status;

      // Set completedAt when marking as completed
      if (body.status === TASK_STATUS.COMPLETED && task.status !== TASK_STATUS.COMPLETED) {
        updateData.completedAt = new Date();
      }

      // Clear completedAt when unmarking completion
      if (body.status !== TASK_STATUS.COMPLETED && task.status === TASK_STATUS.COMPLETED) {
        updateData.completedAt = null;
      }
    }

    if (body.columnId !== undefined) {
      updateData.columnId = body.columnId;
    }

    if (body.sortOrder !== undefined) {
      updateData.sortOrder = body.sortOrder;
    }

    if (body.title !== undefined) {
      updateData.title = body.title;
    }

    if (body.description !== undefined) {
      updateData.description = body.description;
    }

    if (body.dueDate !== undefined) {
      updateData.dueDate = new Date(body.dueDate);
    }

    if (body.dueDateType !== undefined) {
      updateData.dueDateType = body.dueDateType;
    }

    if (body.dueDateValue !== undefined) {
      updateData.dueDateValue = body.dueDateValue;
    }

    // Check if task is being archived
    const wasArchived = body.archived === true && task.status !== 'archived';

    // Check if task should be archived
    if (body.archived === true) {
      updateData.archived = true;
    }

    // Update the task
    const updatedTask = await db.task.update({
      where: { id },
      data: updateData,
      include: {
        parse: {
          select: {
            id: true,
            propertyAddress: true,
            effectiveDate: true,
            closingDate: true,
          },
        },
      },
    });

    // Sync changes to Google Calendar automatically
    if (body.archived === true) {
      // Archive task in calendar
      archiveTaskInCalendar(dbUser.id, id).catch((error) => {
        console.error('Failed to archive task in calendar:', error);
      });
    } else {
      // Sync updated task to calendar
      syncTaskToCalendar(dbUser.id, id).catch((error) => {
        console.error('Failed to sync task to calendar:', error);
      });
    }

    // Sync task changes back to timeline (if task has TIMELINE category and dueDate changed)
    if (body.dueDate !== undefined) {
      syncTaskToTimeline(id).catch((error) => {
        console.error('Failed to sync task to timeline:', error);
      });
    }

    return NextResponse.json({ task: updatedTask });
  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json(
      { error: 'Failed to update task' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tasks/[id]
 * Delete a task
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { id } = params;

    // Verify task belongs to user
    const task = await db.task.findUnique({
      where: { id },
      select: { userId: true, isCustom: true, taskTypes: true },
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    if (task.userId !== dbUser.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Delete from Google Calendar first
    await deleteTaskFromCalendar(dbUser.id, id);

    // Delete the task and decrement custom task count if it's a custom task
    await db.$transaction(async (tx) => {
      await tx.task.delete({
        where: { id },
      });

      // Only decrement custom task count for custom tasks
      if (task.isCustom) {
        await tx.user.update({
          where: { id: dbUser.id },
          data: { customTaskCount: { decrement: 1 } },
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting task:', error);
    return NextResponse.json(
      { error: 'Failed to delete task' },
      { status: 500 }
    );
  }
}
