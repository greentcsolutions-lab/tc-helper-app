// src/lib/google-calendar/sync-timeline-events.ts
// Syncs ALL tasks from database to Google Calendar

import { getGoogleCalendarClient } from './client';
import { prisma } from '@/lib/prisma';
import { EVENT_COLORS } from '@/types/calendar';

/**
 * Syncs all tasks for a parse to Google Calendar
 * Google Calendar now mirrors the TASKS database, not timelineDataStructured
 */
export async function syncTimelineEventsToCalendar(
  parseId: string,
  userId: string
): Promise<{ success: boolean; eventsSynced: number; error?: string }> {
  try {
    const calendar = await getGoogleCalendarClient(userId);
    if (!calendar) {
      return { success: false, eventsSynced: 0, error: 'Calendar client not available' };
    }

    const settings = await prisma.calendarSettings.findUnique({
      where: { userId },
    });

    if (!settings || !settings.syncEnabled || !settings.primaryCalendarId) {
      return { success: false, eventsSynced: 0, error: 'Calendar sync not enabled' };
    }

    // Get the parse to check status
    const parse = await prisma.parse.findUnique({
      where: { id: parseId },
      select: {
        id: true,
        userId: true,
        status: true,
      },
    });

    if (!parse || parse.userId !== userId) {
      return { success: false, eventsSynced: 0, error: 'Parse not found' };
    }

    // Don't sync archived transactions
    if (parse.status === 'ARCHIVED') {
      return { success: true, eventsSynced: 0 };
    }

    // Get ALL tasks for this parse (not just timeline tasks)
    // Google Calendar syncs with ALL tasks now
    const tasks = await prisma.task.findMany({
      where: {
        parseId,
        userId,
        archived: false,
      },
      select: {
        id: true,
        title: true,
        description: true,
        dueDate: true,
        propertyAddress: true,
        taskTypes: true,
        googleCalendarEventId: true,
        timelineEventKey: true,
      },
    });

    console.log(`[syncTimelineEventsToCalendar] Syncing ${tasks.length} tasks for parse ${parseId}`);

    let eventsSynced = 0;

    // Iterate through all tasks and sync to calendar
    for (const task of tasks) {
      const result = await syncSingleTaskToCalendar(
        calendar,
        settings.primaryCalendarId,
        task
      );

      if (result.googleEventId) {
        // Update the task with the calendar event ID
        await prisma.task.update({
          where: { id: task.id },
          data: {
            googleCalendarEventId: result.googleEventId,
            syncedToCalendar: true,
            lastSyncedAt: new Date(),
          },
        });
        eventsSynced++;
      }
    }

    return { success: true, eventsSynced };
  } catch (error) {
    console.error('Error syncing tasks to calendar:', error);
    return {
      success: false,
      eventsSynced: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Syncs a single task to Google Calendar
 * NO [TC Helper] prefix - events go to a separate TC Helper calendar
 */
async function syncSingleTaskToCalendar(
  calendar: any,
  calendarId: string,
  task: {
    id: string;
    title: string;
    description: string | null;
    dueDate: Date;
    propertyAddress: string | null;
    taskTypes: string[];
    googleCalendarEventId: string | null;
    timelineEventKey: string | null;
  }
): Promise<{ googleEventId?: string; error?: string }> {
  try {
    const eventDate = new Date(task.dueDate);

    // For all-day events, use simple date strings without time manipulation
    // Google Calendar end date is EXCLUSIVE, so add 1 day using UTC to avoid timezone issues
    const startDateStr = eventDate.toISOString().split('T')[0];
    const endDateObj = new Date(eventDate);
    endDateObj.setUTCDate(endDateObj.getUTCDate() + 1); // Add 1 day in UTC
    const endDateStr = endDateObj.toISOString().split('T')[0];

    console.log(`[syncSingleTask] Task ${task.id} - dueDate: ${task.dueDate}, startDateStr: ${startDateStr}, endDateStr: ${endDateStr}`);

    // Build title - NO [TC Helper] prefix
    const title = task.title;

    // Build description
    let description = '';
    if (task.propertyAddress) {
      description += `Property: ${task.propertyAddress}\n`;
    }
    if (task.description) {
      description += `${task.description}\n`;
    }

    // Determine color based on task types
    let colorId: string = EVENT_COLORS.TIMELINE;
    if (task.taskTypes.includes('escrow')) {
      colorId = EVENT_COLORS.ESCROW;
    } else if (task.taskTypes.includes('lender')) {
      colorId = EVENT_COLORS.LENDER;
    } else if (task.taskTypes.includes('broker')) {
      colorId = EVENT_COLORS.BROKER;
    } else if (task.timelineEventKey?.toLowerCase().includes('contingency')) {
      colorId = EVENT_COLORS.CUSTOM; // Cyan for contingencies
    }

    const calendarEvent = {
      summary: title,
      description: description.trim() || undefined,
      start: {
        date: startDateStr,
      },
      end: {
        date: endDateStr,
      },
      colorId,
      extendedProperties: {
        private: {
          tcHelperTaskId: task.id, // Store taskId instead of parseId/eventKey
          tcHelperType: 'task',
        },
      },
    };

    // Check if event already exists in calendar
    if (task.googleCalendarEventId) {
      try {
        // Update existing event
        const response = await calendar.events.update({
          calendarId,
          eventId: task.googleCalendarEventId,
          requestBody: calendarEvent,
        });

        console.log(`[syncSingleTask] Updated calendar event for task ${task.id}`);
        return { googleEventId: response.data.id || undefined };
      } catch (updateError: any) {
        // If update fails (event might not exist), fall through to search/create
        if (updateError?.code === 404) {
          console.log(`[syncSingleTask] Event ${task.googleCalendarEventId} not found, will search/create`);
        } else {
          throw updateError;
        }
      }
    }

    // Search for existing event by taskId before creating
    // This prevents duplicates when googleCalendarEventId is missing or stale
    try {
      // Search for events on this date
      const endDateObj = new Date(eventDate);
      endDateObj.setUTCDate(endDateObj.getUTCDate() + 1);

      const searchResponse = await calendar.events.list({
        calendarId,
        timeMin: eventDate.toISOString(),
        timeMax: endDateObj.toISOString(),
        singleEvents: true,
        maxResults: 50,
      });

      const existingEvents = searchResponse.data.items || [];

      // Try to find matching event by taskId
      const matchingEvent = existingEvents.find((event: any) => {
        return event.extendedProperties?.private?.tcHelperTaskId === task.id;
      });

      if (matchingEvent?.id) {
        console.log(`[syncSingleTask] Found existing event for task ${task.id}, updating`);
        // Found existing event - update it instead of creating new
        const response = await calendar.events.update({
          calendarId,
          eventId: matchingEvent.id,
          requestBody: calendarEvent,
        });

        return { googleEventId: response.data.id || undefined };
      }
    } catch (searchError) {
      console.error('Error searching for existing event:', searchError);
      // Continue to create new event if search fails
    }

    // No existing event found - create new one
    console.log(`[syncSingleTask] Creating new calendar event for task ${task.id}`);
    const response = await calendar.events.insert({
      calendarId,
      requestBody: calendarEvent,
    });

    return { googleEventId: response.data.id || undefined };
  } catch (error) {
    console.error(`Error syncing task ${task.id}:`, error);
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Deletes all task calendar events for a parse
 * Called when a parse is deleted or archived
 */
export async function deleteTimelineEventsFromCalendar(
  parseId: string,
  userId: string
): Promise<{ success: boolean; eventsDeleted: number; error?: string }> {
  try {
    const calendar = await getGoogleCalendarClient(userId);
    if (!calendar) {
      return { success: false, eventsDeleted: 0, error: 'Calendar client not available' };
    }

    const settings = await prisma.calendarSettings.findUnique({
      where: { userId },
    });

    if (!settings || !settings.primaryCalendarId) {
      return { success: true, eventsDeleted: 0 };
    }

    // Get all tasks for this parse
    const tasks = await prisma.task.findMany({
      where: {
        parseId,
        googleCalendarEventId: { not: null },
      },
      select: {
        id: true,
        googleCalendarEventId: true,
      },
    });

    let eventsDeleted = 0;

    // Delete each calendar event
    for (const task of tasks) {
      if (task.googleCalendarEventId) {
        try {
          await calendar.events.delete({
            calendarId: settings.primaryCalendarId,
            eventId: task.googleCalendarEventId,
          });

          // Clear the calendar event ID from the task
          await prisma.task.update({
            where: { id: task.id },
            data: {
              googleCalendarEventId: null,
              syncedToCalendar: false,
            },
          });

          eventsDeleted++;
        } catch (error) {
          console.error(`Failed to delete calendar event ${task.googleCalendarEventId}:`, error);
        }
      }
    }

    return { success: true, eventsDeleted };
  } catch (error) {
    console.error('Error deleting task calendar events:', error);
    return {
      success: false,
      eventsDeleted: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
