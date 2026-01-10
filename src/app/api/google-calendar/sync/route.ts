// src/app/api/google-calendar/sync/route.ts
// Manual sync trigger

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { syncCalendarToApp } from '@/lib/google-calendar/calendar-to-app';
import { performInitialSync } from '@/lib/google-calendar/sync';
import { db as prisma } from '@/lib/prisma';

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

    const body = await request.json();
    const { direction } = body; // 'app-to-calendar' or 'calendar-to-app' or 'both'

    let appToCalendarResult = null;
    let calendarToAppResult = null;

    if (direction === 'app-to-calendar' || direction === 'both') {
      // Sync all tasks to calendar
      appToCalendarResult = await performInitialSync(user.id);
    }

    if (direction === 'calendar-to-app' || direction === 'both') {
      // Sync calendar events to app
      calendarToAppResult = await syncCalendarToApp(user.id);
    }

    return NextResponse.json({
      success: true,
      appToCalendar: appToCalendarResult,
      calendarToApp: calendarToAppResult,
    });
  } catch (error) {
    console.error('Error performing manual sync:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
