// src/app/api/tasks/sync/route.ts
// API route for syncing timeline tasks

import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/prisma';
import { syncAllTimelineTasks, syncTimelineTasks } from '@/lib/tasks/sync-timeline-tasks';

/**
 * POST /api/tasks/sync
 * Sync timeline tasks for all parses or a specific parse
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
    const { parseId } = body;

    if (parseId) {
      // Sync specific parse
      await syncTimelineTasks(parseId, dbUser.id);
    } else {
      // Sync all parses for user
      await syncAllTimelineTasks(dbUser.id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error syncing timeline tasks:', error);
    return NextResponse.json(
      { error: 'Failed to sync timeline tasks' },
      { status: 500 }
    );
  }
}
