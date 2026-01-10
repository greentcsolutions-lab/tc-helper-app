// src/app/api/tasks/route.ts
// API routes for task management

import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/prisma';
import { TASK_TYPES, TASK_STATUS } from '@/types/task';
import { syncTaskToCalendar } from '@/lib/google-calendar/sync';

/**
 * GET /api/tasks
 * Fetch all tasks for the current user with optional filters
 */
export async function GET(request: NextRequest) {
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

    // Get query parameters for filtering
    const searchParams = request.nextUrl.searchParams;
    const parseId = searchParams.get('parseId');
    const taskType = searchParams.get('taskType'); // Filter by tasks that contain this type
    const status = searchParams.get('status');

    // Build where clause
    const where: any = {
      userId: dbUser.id,
    };

    if (parseId) {
      where.parseId = parseId;
    }

    if (taskType) {
      // Filter tasks that have this type in their taskTypes array
      where.taskTypes = {
        has: taskType,
      };
    }

    if (status) {
      where.status = status;
    }

    // Fetch tasks
    const tasks = await db.task.findMany({
      where,
      include: {
        parse: {
          select: {
            id: true,
            propertyAddress: true,
            effectiveDate: true,
            closingDate: true,
            status: true,
          },
        },
      },
      orderBy: [
        { columnId: 'asc' },
        { sortOrder: 'asc' },
        { dueDate: 'asc' },
      ],
    });

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tasks
 * Create a new custom task
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
      select: {
        id: true,
        planType: true,
      },
    });

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      parseId,
      taskTypes, // Now expects an array of task types
      title,
      description,
      dueDate,
      dueDateType,
      dueDateValue,
      status,
      columnId,
      isCustom,
    } = body;

    // Validation
    if (!title || !taskTypes || !Array.isArray(taskTypes) || taskTypes.length === 0 || !dueDate) {
      return NextResponse.json(
        { error: 'Missing required fields. taskTypes must be a non-empty array.' },
        { status: 400 }
      );
    }

    // Validate all taskTypes are valid
    const validTaskTypes = Object.values(TASK_TYPES);
    const invalidTypes = taskTypes.filter((type: string) => !validTaskTypes.includes(type));
    if (invalidTypes.length > 0) {
      return NextResponse.json(
        { error: `Invalid task types: ${invalidTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Don't allow creating timeline tasks via API (they're auto-synced) unless it's also another type
    if (taskTypes.includes(TASK_TYPES.TIMELINE) && taskTypes.length === 1) {
      return NextResponse.json(
        { error: 'Cannot create timeline-only tasks manually' },
        { status: 400 }
      );
    }

    // Check custom task limit based on plan type
    const isCreatingCustomTask = isCustom !== false; // Default to true if not specified

    if (isCreatingCustomTask) {
      // Count non-archived custom tasks
      const currentCustomTaskCount = await db.task.count({
        where: {
          userId: dbUser.id,
          isCustom: true,
          archived: false,
        },
      });

      // Determine limit based on plan type
      const customTaskLimit = dbUser.planType === 'BASIC' ? 10 : 1;

      if (currentCustomTaskCount >= customTaskLimit) {
        const upgradeMessage =
          dbUser.planType === 'FREE'
            ? 'Free tier limited to 1 custom task. Upgrade to Basic for 10 custom tasks.'
            : 'Basic plan limited to 10 custom tasks.';

        return NextResponse.json(
          {
            error: upgradeMessage,
            currentCount: currentCustomTaskCount,
            limit: customTaskLimit,
          },
          { status: 403 }
        );
      }
    }

    // Create the task
    const result = await db.task.create({
      data: {
        userId: dbUser.id,
        parseId: parseId || null,
        taskTypes, // Array of task types
        title,
        description: description || null,
        dueDate: new Date(dueDate),
        dueDateType: dueDateType || 'specific',
        dueDateValue: dueDateValue || null,
        status: status || TASK_STATUS.NOT_STARTED,
        columnId: columnId || TASK_STATUS.NOT_STARTED,
        isCustom: isCustom !== undefined ? isCustom : true,
      },
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

    // Sync to Google Calendar (async, don't wait for completion)
    syncTaskToCalendar(dbUser.id, result.id).catch((error) => {
      console.error('Failed to sync task to calendar:', error);
      // Don't fail the request if calendar sync fails
    });

    return NextResponse.json({ task: result }, { status: 201 });
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json(
      { error: 'Failed to create task' },
      { status: 500 }
    );
  }
}
