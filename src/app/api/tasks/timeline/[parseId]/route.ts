// src/app/api/tasks/timeline/[parseId]/route.ts
// API route to fetch timeline tasks for a specific parse

import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/prisma';
import { TASK_TYPES } from '@/types/task';

/**
 * GET /api/tasks/timeline/[parseId]
 * Fetches all timeline tasks for a specific parse
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { parseId: string } }
) {
  try {
    const user = await currentUser();
    if (!user) {
      console.error('[timeline/GET] Unauthorized - no user');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dbUser = await db.user.findUnique({
      where: { clerkId: user.id },
      select: { id: true },
    });

    if (!dbUser) {
      console.error('[timeline/GET] User not found in database');
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const parseId = params.parseId;
    console.log(`[timeline/GET] Fetching timeline tasks for parseId: ${parseId}, userId: ${dbUser.id}`);

    // Verify the parse belongs to this user
    const parse = await db.parse.findUnique({
      where: { id: parseId },
      select: {
        userId: true,
        timelineDataStructured: true,
      },
    });

    if (!parse) {
      console.error(`[timeline/GET] Parse not found: ${parseId}`);
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    if (parse.userId !== dbUser.id) {
      console.error(`[timeline/GET] Unauthorized - parse belongs to different user`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Fetch all tasks with TIMELINE type for this parse
    const tasks = await db.task.findMany({
      where: {
        parseId,
        userId: dbUser.id,
        taskTypes: {
          has: TASK_TYPES.TIMELINE,
        },
      },
      select: {
        id: true,
        title: true,
        description: true,
        dueDate: true,
        timelineEventKey: true,
        status: true,
        archived: true,
      },
      orderBy: {
        dueDate: 'asc',
      },
    });

    console.log(`[timeline/GET] Found ${tasks.length} timeline tasks for parseId: ${parseId}`);

    // Format tasks for the frontend
    const formattedTasks = tasks.map(task => ({
      id: task.id,
      title: task.title,
      description: task.description,
      dueDate: task.dueDate.toISOString(),
      timelineEventKey: task.timelineEventKey,
      status: task.status,
      archived: task.archived,
    }));

    return NextResponse.json({
      success: true,
      tasks: formattedTasks,
    });
  } catch (error) {
    console.error('[timeline/GET] Error fetching timeline tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch timeline tasks' },
      { status: 500 }
    );
  }
}
