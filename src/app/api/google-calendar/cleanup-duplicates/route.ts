// src/app/api/google-calendar/cleanup-duplicates/route.ts
// Cleanup duplicate calendar events

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getGoogleCalendarClient } from '@/lib/google-calendar/client';
import { prisma } from '@/lib/prisma';

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

    const calendar = await getGoogleCalendarClient(user.id);
    if (!calendar) {
      return NextResponse.json({ error: 'Calendar not connected' }, { status: 400 });
    }

    const settings = await prisma.calendarSettings.findUnique({
      where: { userId: user.id },
    });

    if (!settings || !settings.primaryCalendarId) {
      return NextResponse.json({ error: 'Calendar not configured' }, { status: 400 });
    }

    // Get all events from the calendar
    const response = await calendar.events.list({
      calendarId: settings.primaryCalendarId,
      timeMin: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(), // Last year
      maxResults: 2500,
      singleEvents: true,
    });

    const events = response.data.items || [];

    // Group events by title and start date
    const eventGroups = new Map<string, any[]>();

    for (const event of events) {
      if (!event.summary?.startsWith('[TC Helper]')) continue;

      const startDate = event.start?.date || event.start?.dateTime;
      if (!startDate) continue;

      const key = `${event.summary}-${startDate}`;
      if (!eventGroups.has(key)) {
        eventGroups.set(key, []);
      }
      eventGroups.get(key)!.push(event);
    }

    // Find and delete duplicates
    let duplicatesDeleted = 0;
    let eventsKept = 0;

    for (const [key, group] of eventGroups) {
      if (group.length > 1) {
        // Keep the first one, delete the rest
        const [keep, ...duplicates] = group;
        eventsKept++;

        for (const duplicate of duplicates) {
          if (duplicate.id) {
            try {
              await calendar.events.delete({
                calendarId: settings.primaryCalendarId,
                eventId: duplicate.id,
              });
              duplicatesDeleted++;
              console.log(`Deleted duplicate event: ${duplicate.summary} on ${duplicate.start?.date || duplicate.start?.dateTime}`);
            } catch (error) {
              console.error(`Failed to delete event ${duplicate.id}:`, error);
            }
          }
        }
      } else {
        eventsKept++;
      }
    }

    // Reset all tasks to not synced so they can be synced fresh
    await prisma.task.updateMany({
      where: {
        userId: user.id,
        taskTypes: {
          has: 'timeline',
        },
      },
      data: {
        googleCalendarEventId: null,
        syncedToCalendar: false,
        lastSyncedAt: null,
      },
    });

    return NextResponse.json({
      success: true,
      duplicatesDeleted,
      eventsKept,
      message: `Removed ${duplicatesDeleted} duplicate events. ${eventsKept} unique events remain. Run a manual sync to recreate fresh links.`,
    });
  } catch (error) {
    console.error('Error cleaning up duplicates:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
