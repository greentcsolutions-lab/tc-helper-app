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

    // Delete ALL [TC Helper] events from Google Calendar
    // This is simpler and safer - we'll re-sync everything fresh afterwards
    let eventsDeleted = 0;

    for (const event of events) {
      if (!event.summary?.startsWith('[TC Helper]')) continue;

      if (event.id) {
        try {
          await calendar.events.delete({
            calendarId: settings.primaryCalendarId,
            eventId: event.id,
          });
          eventsDeleted++;
          console.log(`Deleted event: ${event.summary}`);
        } catch (error) {
          console.error(`Failed to delete event ${event.id}:`, error);
        }
      }
    }

    // Clear googleCalendarEventId from all timeline events in all parses
    // This allows them to be re-synced fresh
    const parses = await prisma.parse.findMany({
      where: {
        userId: user.id,
        status: { in: ['COMPLETED', 'NEEDS_REVIEW'] },
      },
      select: {
        id: true,
        timelineDataStructured: true,
      },
    });

    for (const parse of parses) {
      const timelineData = parse.timelineDataStructured as any;
      if (timelineData && typeof timelineData === 'object') {
        // Clear googleCalendarEventId from all timeline events
        for (const eventKey of Object.keys(timelineData)) {
          if (timelineData[eventKey]?.googleCalendarEventId) {
            delete timelineData[eventKey].googleCalendarEventId;
          }
        }

        // Save updated timeline data
        await prisma.parse.update({
          where: { id: parse.id },
          data: {
            timelineDataStructured: timelineData,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      eventsDeleted,
      message: `Deleted all ${eventsDeleted} calendar events. Click "Sync Now" to recreate them fresh.`,
    });
  } catch (error) {
    console.error('Error cleaning up duplicates:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
