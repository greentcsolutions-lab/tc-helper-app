// src/lib/google-calendar/calendar-to-app.ts
// Sync Google Calendar events to app tasks

import { calendar_v3 } from 'googleapis';
import { getGoogleCalendarClient } from './client';
import { prisma } from '@/lib/prisma';
import { matchPropertyAddress } from './property-matcher';
import { inferTaskTypes } from './ai-inference';
import { TASK_STATUS } from '@/types/task';

/**
 * Syncs changes from Google Calendar to the app
 * Called when webhook receives notification of calendar changes
 */
export async function syncCalendarToApp(userId: string): Promise<{
  success: boolean;
  totalProcessed: number;
  totalCreated: number;
  totalUpdated: number;
  totalDeleted: number;
  error?: string;
}> {
  let totalProcessed = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalDeleted = 0;

  try {
    const calendar = await getGoogleCalendarClient(userId);
    if (!calendar) {
      return {
        success: false,
        totalProcessed,
        totalCreated,
        totalUpdated,
        totalDeleted,
        error: 'Calendar client not available',
      };
    }

    const settings = await prisma.calendarSettings.findUnique({
      where: { userId },
    });

    if (!settings || !settings.primaryCalendarId) {
      return {
        success: false,
        totalProcessed,
        totalCreated,
        totalUpdated,
        totalDeleted,
        error: 'Calendar not configured',
      };
    }

    // Get all events from the calendar
    const response = await calendar.events.list({
      calendarId: settings.primaryCalendarId,
      timeMin: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(), // Last 90 days
      maxResults: 2500,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items || [];

    // Process each event
    for (const event of events) {
      totalProcessed++;

      if (!event.id) continue;

      // Check if this is an app-created event
      const isAppEvent = event.extendedProperties?.private?.tcHelperId;

      if (isAppEvent) {
        // This is an app event - sync changes back to task
        await syncAppEventChanges(userId, event);
        totalUpdated++;
      } else {
        // This is an external event - check if it should be synced
        const shouldSync = await shouldSyncExternalEvent(userId, event);
        if (shouldSync) {
          await syncExternalEvent(userId, event);
          totalCreated++;
        } else {
          // Store as CalendarEvent for grayed-out display
          await storeNonAppEvent(userId, event, settings.primaryCalendarId);
        }
      }
    }

    // Check for deleted events
    const tasks = await prisma.task.findMany({
      where: {
        userId,
        googleCalendarEventId: { not: null },
      },
    });

    const eventIds = new Set(events.map((e) => e.id));
    for (const task of tasks) {
      if (task.googleCalendarEventId && !eventIds.has(task.googleCalendarEventId)) {
        // Event was deleted from calendar - delete task if it's a synced external event
        // or just mark as not synced if it's an app-created task
        if (task.isCustom && !task.parseId) {
          // External event task - delete it
          await prisma.task.delete({ where: { id: task.id } });
          totalDeleted++;
        } else {
          // App-created task - just mark as not synced
          await prisma.task.update({
            where: { id: task.id },
            data: { googleCalendarEventId: null, syncedToCalendar: false },
          });
        }
      }
    }

    // Update sync timestamp
    await prisma.calendarSettings.update({
      where: { userId },
      data: { lastSyncAt: new Date() },
    });

    return {
      success: true,
      totalProcessed,
      totalCreated,
      totalUpdated,
      totalDeleted,
    };
  } catch (error) {
    console.error('Error syncing calendar to app:', error);
    return {
      success: false,
      totalProcessed,
      totalCreated,
      totalUpdated,
      totalDeleted,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Syncs changes from a Google Calendar event back to the corresponding task or timeline event
 */
async function syncAppEventChanges(
  userId: string,
  event: calendar_v3.Schema$Event
): Promise<void> {
  const taskId = event.extendedProperties?.private?.tcHelperId;
  const parseId = event.extendedProperties?.private?.tcHelperParseId;
  const eventKey = event.extendedProperties?.private?.tcHelperTimelineEventKey;

  // Parse dates
  const startDate = event.start?.date || event.start?.dateTime;
  if (!startDate) return;

  // Extract title (remove [TC Helper] prefix if present)
  let title = event.summary || '';
  if (title.startsWith('[TC Helper] ')) {
    title = title.substring(12);
  }

  // Update timeline event if this is a timeline event
  if (parseId && eventKey) {
    try {
      const parse = await prisma.parse.findUnique({
        where: { id: parseId },
        select: { userId: true, timelineDataStructured: true },
      });

      if (parse && parse.userId === userId) {
        const timelineData = (parse.timelineDataStructured as any) || {};

        if (timelineData[eventKey]) {
          // Update the timeline event
          timelineData[eventKey].effectiveDate = new Date(startDate).toISOString().split('T')[0];
          timelineData[eventKey].displayName = title || timelineData[eventKey].displayName;
          timelineData[eventKey].description = event.description || timelineData[eventKey].description;

          // Save updated timeline data
          await prisma.parse.update({
            where: { id: parseId },
            data: { timelineDataStructured: timelineData },
          });
        }
      }
    } catch (error) {
      console.error('Error updating timeline event from calendar:', error);
    }
  }

  // Update task if this event is linked to a task
  if (taskId) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (task && task.userId === userId) {
      // Update task
      await prisma.task.update({
        where: { id: taskId },
        data: {
          title,
          dueDate: new Date(startDate),
          description: event.description || task.description,
          lastSyncedAt: new Date(),
        },
      });
    }
  }
}

/**
 * Determines if an external calendar event should be synced to the app
 * Returns true if the event is related to a property in the app
 */
async function shouldSyncExternalEvent(
  userId: string,
  event: calendar_v3.Schema$Event
): Promise<boolean> {
  const title = event.summary || '';
  const description = event.description || '';
  const searchText = `${title} ${description}`.toLowerCase();

  // Try to match property address
  const match = await matchPropertyAddress(userId, searchText);

  return match.confidence !== 'none';
}

/**
 * Creates a task from an external calendar event
 */
async function syncExternalEvent(
  userId: string,
  event: calendar_v3.Schema$Event
): Promise<void> {
  if (!event.id || !event.start) return;

  // Check if we've already synced this event
  const existingEvent = await prisma.calendarEvent.findUnique({
    where: { googleEventId: event.id },
  });

  if (existingEvent && existingEvent.isAppEvent) {
    return; // Already synced
  }

  const title = event.summary || 'Untitled Event';
  const description = event.description || null;
  const startDate = event.start.date || event.start.dateTime;
  if (!startDate) return;

  // Match property address
  const searchText = `${title} ${description || ''}`.toLowerCase();
  const match = await matchPropertyAddress(userId, searchText);

  if (match.confidence === 'none') {
    return; // No property match
  }

  // Infer task types (AI for BASIC plan users)
  const user = await prisma.user.findUnique({ where: { id: userId } });
  let taskTypes = ['timeline']; // Default

  // AI inference for BASIC plan users
  if (user && (user as any).planType === 'BASIC') {
    const inference = await inferTaskTypes(title, description || '', match.propertyAddress);
    taskTypes = inference.taskTypes.length > 0 ? inference.taskTypes : ['timeline'];
  }

  // Create task and increment custom task count in a transaction
  const task = await prisma.$transaction(async (tx) => {
    const newTask = await tx.task.create({
      data: {
        userId,
        parseId: match.parseId || null,
        title,
        description,
        propertyAddress: match.propertyAddress,
        dueDate: new Date(startDate),
        dueDateType: 'specific',
        status: TASK_STATUS.NOT_STARTED,
        taskTypes, // Array of task types
        isCustom: true, // External events count toward custom task limit
        googleCalendarEventId: event.id,
        syncedToCalendar: true,
        lastSyncedAt: new Date(),
      },
    });

    // Increment custom task count (external events count as custom tasks)
    await tx.user.update({
      where: { id: userId },
      data: { customTaskCount: { increment: 1 } },
    });

    return newTask;
  });

  // Add event to Parse timeline if we have a parseId match
  if (match.parseId) {
    try {
      const parse = await prisma.parse.findUnique({
        where: { id: match.parseId },
        select: { timelineDataStructured: true },
      });

      if (parse) {
        const timelineData = (parse.timelineDataStructured as any) || {};

        // Create a unique key for this external event
        const eventKey = `external_${event.id}`;

        // Add to timeline data
        timelineData[eventKey] = {
          dateType: 'specified',
          effectiveDate: new Date(startDate).toISOString().split('T')[0],
          specifiedDate: new Date(startDate).toISOString().split('T')[0],
          displayName: title,
          description: description || undefined,
          waived: false,
          googleCalendarEventId: event.id,
        };

        // Save updated timeline data
        await prisma.parse.update({
          where: { id: match.parseId },
          data: { timelineDataStructured: timelineData },
        });
      }
    } catch (error) {
      console.error('Error adding external event to timeline:', error);
      // Don't fail the sync if timeline update fails
    }
  }

  // Update CalendarEvent record
  await prisma.calendarEvent.upsert({
    where: { googleEventId: event.id },
    create: {
      userId,
      googleEventId: event.id,
      calendarId: event.organizer?.email || 'primary',
      title,
      description,
      start: new Date(startDate),
      end: new Date(event.end?.date || event.end?.dateTime || startDate),
      allDay: !!event.start.date,
      isAppEvent: true,
      matchedPropertyAddress: match.propertyAddress,
      inferredTaskTypes: taskTypes,
    },
    update: {
      isAppEvent: true,
      matchedPropertyAddress: match.propertyAddress,
      inferredTaskTypes: taskTypes,
      lastSyncedAt: new Date(),
    },
  });
}

/**
 * Stores a non-app event for grayed-out display on timeline
 */
async function storeNonAppEvent(
  userId: string,
  event: calendar_v3.Schema$Event,
  calendarId: string
): Promise<void> {
  if (!event.id || !event.start) return;

  const title = event.summary || 'Busy';
  const description = event.description || null;
  const startDate = event.start.date || event.start.dateTime;

  if (!startDate) return;

  const endDate = event.end?.date || event.end?.dateTime || startDate;

  await prisma.calendarEvent.upsert({
    where: { googleEventId: event.id },
    create: {
      userId,
      googleEventId: event.id,
      calendarId,
      title,
      description,
      start: new Date(startDate),
      end: new Date(endDate),
      allDay: !!event.start.date,
      isAppEvent: false,
      lastSyncedAt: new Date(),
    },
    update: {
      title,
      description,
      start: new Date(startDate),
      end: new Date(endDate),
      allDay: !!event.start.date,
      lastSyncedAt: new Date(),
    },
  });
}
