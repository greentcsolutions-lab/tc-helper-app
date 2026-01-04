// src/app/api/tasks/route.ts
// API routes for task management

import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { TASK_TYPES, TASK_STATUS } from '@/types/task';

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
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: user.id },
      select: { id: true },
    });

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get query parameters for filtering
    const searchParams = request.nextUrl.searchParams;
    const parseId = searchParams.get('parseId');
    const taskType = searchParams.get('taskType');
    const status = searchParams.get('status');

    // Build where clause
    const where: any = {
      userId: dbUser.id,
    };

    if (parseId) {
      where.parseId = parseId;
    }

    if (taskType) {
      where.taskType = taskType;
    }

    if (status) {
      where.status = status;
    }

    // Fetch tasks
    const tasks = await prisma.task.findMany({
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
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: user.id },
      select: {
        id: true,
        customTaskCount: true,
        priceId: true,
      },
    });

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      parseId,
      taskType,
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
    if (!title || !taskType || !dueDate) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check custom task limit for free tier (1 task max)
    const isFreeUser = !dbUser.priceId;
    const isCreatingCustomTask = isCustom !== false; // Default to true if not specified

    if (isFreeUser && isCreatingCustomTask) {
      if (dbUser.customTaskCount >= 1) {
        return NextResponse.json(
          { error: 'Free tier limited to 1 custom task. Upgrade to create more.' },
          { status: 403 }
        );
      }
    }

    // Create the task and increment custom task count in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          userId: dbUser.id,
          parseId: parseId || null,
          taskType,
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

      // Increment custom task count if this is a custom task
      if (isCreatingCustomTask) {
        await tx.user.update({
          where: { id: dbUser.id },
          data: { customTaskCount: { increment: 1 } },
        });
      }

      return task;
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
