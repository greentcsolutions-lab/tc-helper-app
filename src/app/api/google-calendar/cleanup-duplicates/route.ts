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

    // Get all timeline tasks from database
    const tasks = await prisma.task.findMany({
      where: {
        userId: user.id,
        taskTypes: {
          has: 'timeline',
        },
        archived: false,
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        googleCalendarEventId: true,
      },
    });

    // Group events by task ID (from extended properties) or by title+date
    const eventsByTask = new Map<string, any[]>();
    const unmatchedEvents: any[] = [];

    for (const event of events) {
      if (!event.summary?.startsWith('[TC Helper]')) continue;

      const taskId = event.extendedProperties?.private?.tcHelperId;

      if (taskId) {
        // Event has task ID - group by task
        if (!eventsByTask.has(taskId)) {
          eventsByTask.set(taskId, []);
        }
        eventsByTask.get(taskId)!.push(event);
      } else {
        // Event doesn't have task ID - try to match by title and date
        const eventTitle = event.summary.replace('[TC Helper] ', '');
        const startDate = event.start?.date || event.start?.dateTime;

        if (!startDate) continue;

        // Find matching task by title and date
        const matchingTask = tasks.find(t => {
          const taskDate = new Date(t.dueDate).toISOString().split('T')[0];
          const eventDate = startDate.split('T')[0];
          return t.title === eventTitle && taskDate === eventDate;
        });

        if (matchingTask) {
          if (!eventsByTask.has(matchingTask.id)) {
            eventsByTask.set(matchingTask.id, []);
          }
          eventsByTask.get(matchingTask.id)!.push(event);
        } else {
          unmatchedEvents.push(event);
        }
      }
    }

    // Find and delete duplicates, keeping one event per task
    let duplicatesDeleted = 0;
    let tasksFixed = 0;

    for (const [taskId, taskEvents] of eventsByTask) {
      if (taskEvents.length > 1) {
        // Multiple events for same task - keep the first one, delete the rest
        const [keep, ...duplicates] = taskEvents;

        // Update task to point to the kept event
        await prisma.task.update({
          where: { id: taskId },
          data: {
            googleCalendarEventId: keep.id || null,
            syncedToCalendar: true,
            lastSyncedAt: new Date(),
          },
        });

        // Delete duplicate events
        for (const duplicate of duplicates) {
          if (duplicate.id) {
            try {
              await calendar.events.delete({
                calendarId: settings.primaryCalendarId,
                eventId: duplicate.id,
              });
              duplicatesDeleted++;
              console.log(`Deleted duplicate event: ${duplicate.summary}`);
            } catch (error) {
              console.error(`Failed to delete event ${duplicate.id}:`, error);
            }
          }
        }

        tasksFixed++;
      } else if (taskEvents.length === 1) {
        // Task has exactly one event - ensure it's properly linked
        const event = taskEvents[0];
        await prisma.task.update({
          where: { id: taskId },
          data: {
            googleCalendarEventId: event.id || null,
            syncedToCalendar: true,
            lastSyncedAt: new Date(),
          },
        });
      }
    }

    // Delete unmatched events (orphaned events with no corresponding task)
    let orphansDeleted = 0;
    for (const event of unmatchedEvents) {
      if (event.id) {
        try {
          await calendar.events.delete({
            calendarId: settings.primaryCalendarId,
            eventId: event.id,
          });
          orphansDeleted++;
          console.log(`Deleted orphaned event: ${event.summary}`);
        } catch (error) {
          console.error(`Failed to delete event ${event.id}:`, error);
        }
      }
    }

    return NextResponse.json({
      success: true,
      duplicatesDeleted,
      orphansDeleted,
      tasksFixed,
      message: `Cleaned up ${duplicatesDeleted} duplicate events and ${orphansDeleted} orphaned events. Fixed ${tasksFixed} tasks with multiple calendar entries.`,
    });
  } catch (error) {
    console.error('Error cleaning up duplicates:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
