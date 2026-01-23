// src/lib/google-calendar/sync.ts
// Logic for pushing App Task updates to Google Calendar

import { calendar_v3 } from 'googleapis';
import { getGoogleCalendarClient } from './client';
import { prisma } from '@/lib/prisma';
import { EVENT_COLORS } from '@/types/calendar';
import { Task } from '@prisma/client';

/**
 * Syncs a single task to Google Calendar (Create or Update)
 * Direction: App → Google Calendar
 */
export async function syncTaskToCalendar(
  userId: string,
  taskId: string
): Promise<{ success: boolean; googleEventId?: string; error?: string }> {
  try {
    const calendar = await getGoogleCalendarClient(userId);
    if (!calendar) {
      throw new Error('Calendar client not available');
    }

    // 1. Get Settings and Task details
    const settings = await prisma.calendarSettings.findUnique({
      where: { userId },
    });

    if (!settings || !settings.syncEnabled || !settings.primaryCalendarId) {
      return { success: false, error: 'Calendar sync not enabled' };
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { parse: true },
    });

    if (!task || task.userId !== userId) {
      throw new Error('Task not found');
    }

    // 2. Prepare the Event Data for Google
    const eventBody: calendar_v3.Schema$Event = buildEventFromTask(
      task, 
      settings.includeFullDetails, 
      settings.excludeFinancialData
    );

    let googleEventId = task.googleCalendarEventId;

    if (googleEventId) {
      // UPDATE existing event
      try {
        const response = await calendar.events.update({
          calendarId: settings.primaryCalendarId,
          eventId: googleEventId,
          requestBody: eventBody,
        });
        googleEventId = response.data.id || null;
        console.log(`[App→Calendar] Updated event for task ${task.id}`);
      } catch (err: any) {
        // If event was deleted in Google, search for it or create new
        if (err.code === 404) {
          console.log(`[App→Calendar] Event ${googleEventId} not found, searching for existing...`);
          googleEventId = null; // Clear it so we search below
        } else {
          throw err;
        }
      }
    }

    // If no googleEventId or event was deleted, search for existing event by taskId
    if (!googleEventId) {
      try {
        const eventDate = new Date(task.dueDate);
        const endDateObj = new Date(eventDate);
        endDateObj.setUTCDate(endDateObj.getUTCDate() + 1);

        const searchResponse = await calendar.events.list({
          calendarId: settings.primaryCalendarId,
          timeMin: eventDate.toISOString(),
          timeMax: endDateObj.toISOString(),
          singleEvents: true,
          maxResults: 50,
        });

        const existingEvents = searchResponse.data.items || [];
        const matchingEvent = existingEvents.find((event: any) => {
          return event.extendedProperties?.private?.tcHelperTaskId === task.id;
        });

        if (matchingEvent?.id) {
          // Found existing event - update it
          const response = await calendar.events.update({
            calendarId: settings.primaryCalendarId,
            eventId: matchingEvent.id,
            requestBody: eventBody,
          });
          googleEventId = response.data.id || null;
          console.log(`[App→Calendar] Found and updated existing event for task ${task.id}`);
        }
      } catch (searchError) {
        console.error('[App→Calendar] Error searching for existing event:', searchError);
      }
    }

    // If still no event found, create new one
    if (!googleEventId) {
      const response = await calendar.events.insert({
        calendarId: settings.primaryCalendarId,
        requestBody: eventBody,
      });
      googleEventId = response.data.id || null;
      console.log(`[App→Calendar] Created new event for task ${task.id}`);
    }

    // 3. Save the Google Event ID back to our Task
    if (googleEventId) {
      await prisma.task.update({
        where: { id: taskId },
        data: {
          googleCalendarEventId: googleEventId,
          syncedToCalendar: true,
          lastSyncedAt: new Date(),
        },
      });
    }

    return { success: true, googleEventId: googleEventId || undefined };

  } catch (error: any) {
    console.error('Task to Calendar sync failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Performs an initial sync of all user's tasks to Google Calendar.
 * This is usually called once after the user connects their calendar.
 * Direction: App → Google Calendar
 */
export async function performInitialSync(
  userId: string
): Promise<{
  success: boolean;
  syncedTasks: number;
  errors: { taskId: string; error: string }[];
}> {
  console.log(`[Initial Sync] Starting for user ${userId}`);
  const errors: { taskId: string; error: string }[] = [];
  let syncedTasks = 0;

  try {
    // 1. Get all non-archived tasks for the user
    const tasks = await prisma.task.findMany({
      where: {
        userId: userId,
        archived: false,
      },
    });

    if (tasks.length === 0) {
      console.log('[Initial Sync] No tasks to sync.');
      return { success: true, syncedTasks: 0, errors: [] };
    }

    console.log(`[Initial Sync] Found ${tasks.length} tasks to sync.`);

    // 2. Sync all tasks in parallel
    const syncPromises = tasks.map(async (task) => {
      const result = await syncTaskToCalendar(userId, task.id);
      if (result.success) {
        syncedTasks++;
      } else {
        errors.push({ taskId: task.id, error: result.error || 'Unknown error' });
      }
    });

    await Promise.all(syncPromises);

    // 3. Update calendar settings to mark initial sync as complete
    await prisma.calendarSettings.update({
      where: { userId },
      data: {
        initialSyncCompleted: true,
        lastSyncStatus: errors.length > 0 ? 'ERROR' : 'SUCCESS',
        lastSyncedAt: new Date(),
        lastSyncError: errors.length > 0 ? `${errors.length} tasks failed to sync.` : null,
      },
    });

    if (errors.length > 0) {
      console.error(`[Initial Sync] Completed with ${errors.length} errors.`);
      return { success: false, syncedTasks, errors };
    }

    console.log(`[Initial Sync] Successfully synced ${syncedTasks} tasks.`);
    return { success: true, syncedTasks, errors };

  } catch (error: any) {
    console.error('[Initial Sync] Failed:', error);
    await prisma.calendarSettings.update({
        where: { userId },
        data: {
            lastSyncStatus: 'ERROR',
            lastSyncError: error.message || 'Initial sync failed entirely.',
        },
    }).catch(() => {}); // Avoid crashing if this update fails too
    return { success: false, syncedTasks: 0, errors: [{ taskId: 'general', error: error.message }] };
  }
}


/**
 * Deletes a task's event from Google Calendar
 */
export async function deleteTaskFromCalendar(
  userId: string,
  taskId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const calendar = await getGoogleCalendarClient(userId);
    if (!calendar) {
      return { success: false, error: 'Calendar client not available' };
    }

    const settings = await prisma.calendarSettings.findUnique({
      where: { userId },
    });

    if (!settings || !settings.primaryCalendarId) {
      return { success: true }; // No calendar to delete from
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { googleCalendarEventId: true },
    });

    if (!task?.googleCalendarEventId) {
      return { success: true }; // No calendar event to delete
    }

    // Delete the event from Google Calendar
    try {
      await calendar.events.delete({
        calendarId: settings.primaryCalendarId,
        eventId: task.googleCalendarEventId,
      });
    } catch (err: any) {
      // Ignore 404 errors (event already deleted)
      if (err.code !== 404) {
        throw err;
      }
    }

    return { success: true };
  } catch (error: any) {
    console.error('Delete from Calendar failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Archives a task's event in Google Calendar (moves to archived calendar or deletes)
 */
export async function archiveTaskInCalendar(
  userId: string,
  taskId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const calendar = await getGoogleCalendarClient(userId);
    if (!calendar) {
      return { success: false, error: 'Calendar client not available' };
    }

    const settings = await prisma.calendarSettings.findUnique({
      where: { userId },
    });

    if (!settings || !settings.primaryCalendarId) {
      return { success: true }; // No calendar configured
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { googleCalendarEventId: true },
    });

    if (!task?.googleCalendarEventId) {
      return { success: true }; // No calendar event to archive
    }

    // For now, just delete the event when archiving
    // TODO: In future, could move to an "Archived" calendar
    try {
      await calendar.events.delete({
        calendarId: settings.primaryCalendarId,
        eventId: task.googleCalendarEventId,
      });

      // Clear the calendar event ID from task
      await prisma.task.update({
        where: { id: taskId },
        data: {
          googleCalendarEventId: null,
          syncedToCalendar: false,
        },
      });
    } catch (err: any) {
      // Ignore 404 errors
      if (err.code !== 404) {
        throw err;
      }
    }

    return { success: true };
  } catch (error: any) {
    console.error('Archive in Calendar failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Helper to transform a Task object into a Google Calendar Event
 * Uses structured description format with metadata (no title prefix)
 */
function buildEventFromTask(
  task: any,
  includeDetails: boolean,
  excludeFinancial: boolean
): calendar_v3.Schema$Event {
  // Use clean title (no prefix)
  const title = task.title;

  // Build structured description with metadata
  let description = '';

  // Always include structured metadata section
  description += '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
  description += '📋 TC Helper Task Information\n';
  description += '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

  // Category (from taskTypes array)
  const categories = task.taskTypes && task.taskTypes.length > 0
    ? task.taskTypes.join(', ')
    : 'None';
  description += `Category: ${categories}\n`;

  // Property (from task.propertyAddress field)
  const property = task.propertyAddress || 'Not specified';
  description += `Property: ${property}\n`;

  // Status
  const statusDisplay = task.status ? task.status.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) : 'Not Started';
  description += `Status: ${statusDisplay}\n\n`;

  // Read-only warning
  description += '⚠️ This information is read-only and managed by TC Helper.\n';
  description += 'Any edits to the above metadata will be overwritten on the next sync.\n\n';

  description += '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
  description += 'User Notes:\n';
  description += '(Add your notes here)\n';

  // Optional: Add additional details if enabled
  if (includeDetails) {
    if (task.description) {
      description += `\nTask Description: ${task.description}\n`;
    }
    if (task.amount && !excludeFinancial) {
      description += `Amount: $${task.amount}\n`;
    }
    description += `\nView in App: ${process.env.NEXT_PUBLIC_APP_URL}/tasks/${task.id}`;
  }

  // Choose Google Color based on status/type
  let colorId = EVENT_COLORS.TIMELINE; // Default Blue
  if (task.status === 'completed') {
    colorId = '8'; // Gray in Google
  } else if (new Date(task.dueDate) < new Date() && task.status !== 'completed') {
    colorId = '11'; // Red for overdue
  }

  const dateStr = task.dueDate
    ? new Date(task.dueDate).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];

  return {
    summary: title,
    description: description.trim(),
    colorId: colorId,
    start: { date: dateStr }, // All-day event
    end: { date: dateStr },
    extendedProperties: {
      private: {
        tcHelperTaskId: task.id, // Use consistent naming with sync-timeline-events
        parseId: task.parseId || '',
      }
    }
  };
}