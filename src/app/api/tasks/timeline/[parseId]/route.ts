// src/app/api/tasks/timeline/[parseId]/route.ts
// Fetches timeline tasks for a specific parse

import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: { parseId: string } }
) {
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

    const parseId = params.parseId;

    // Verify the parse belongs to this user
    const parse = await db.parse.findUnique({
      where: { id: parseId },
      select: { userId: true },
    });

    if (!parse) {
      return NextResponse.json({ error: 'Parse not found' }, { status: 404 });
    }

    if (parse.userId !== dbUser.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Fetch timeline tasks for this parse
    const tasks = await db.task.findMany({
      where: {
        parseId,
        userId: dbUser.id,
        taskTypes: { has: 'timeline' },
        archived: false,
      },
      select: {
        id: true,
        title: true,
        description: true,
        dueDate: true,
        timelineEventKey: true,
        status: true,
      },
      orderBy: { dueDate: 'asc' },
    });

    return NextResponse.json({
      success: true,
      tasks,
    });
  } catch (error) {
    console.error('Error fetching timeline tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch timeline tasks' },
      { status: 500 }
    );
  }
}
