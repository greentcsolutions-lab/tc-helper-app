// src/app/api/google-calendar/poll-sync/route.ts
// Polling endpoint for periodic calendar sync (fallback mechanism)

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { syncCalendarToApp } from '@/lib/google-calendar/calendar-to-app';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/google-calendar/poll-sync
 * Triggers an incremental sync from Google Calendar to the app
 * This serves as a fallback if webhooks fail or are delayed
 */
export async function POST(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if calendar sync is enabled
    const settings = await prisma.calendarSettings.findUnique({
      where: { userId: user.id },
    });

    if (!settings || !settings.syncEnabled || !settings.primaryCalendarId) {
      return NextResponse.json({
        success: false,
        message: 'Calendar sync not enabled'
      });
    }

    // Perform incremental sync using sync tokens
    const result = await syncCalendarToApp(user.id);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      totalProcessed: result.totalProcessed,
      totalCreated: result.totalCreated,
      totalUpdated: result.totalUpdated,
      totalDeleted: result.totalDeleted,
    });
  } catch (error) {
    console.error('Error during poll sync:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
