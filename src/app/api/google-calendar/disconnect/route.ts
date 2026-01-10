// src/app/api/google-calendar/disconnect/route.ts
// Disconnects Google Calendar integration

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { revokeAccess } from '@/lib/google-calendar/client';
import { stopWebhook } from '@/lib/google-calendar/webhook';
import { deleteCalendars } from '@/lib/google-calendar/calendar-init';
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

    // Stop webhook
    await stopWebhook(user.id);

    // Optionally delete calendars (you might want to make this configurable)
    // Commented out by default to preserve user's calendar data
    // await deleteCalendars(user.id);

    // Revoke access and clear tokens
    const success = await revokeAccess(user.id);

    if (!success) {
      return NextResponse.json({ error: 'Failed to disconnect calendar' }, { status: 500 });
    }

    // Clear all synced event IDs from tasks
    await prisma.task.updateMany({
      where: {
        userId: user.id,
        googleCalendarEventId: { not: null },
      },
      data: {
        googleCalendarEventId: null,
        syncedToCalendar: false,
      },
    });

    // Delete all calendar events
    await prisma.calendarEvent.deleteMany({
      where: { userId: user.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error disconnecting calendar:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
