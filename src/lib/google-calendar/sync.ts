// src/lib/google-calendar/sync.ts
// Bidirectional sync between app tasks and Google Calendar

import { calendar_v3 } from 'googleapis';
import { getGoogleCalendarClient } from './client';
import { prisma } from '@/lib/prisma';
import { GoogleCalendarEvent, SyncResult, SyncOperation, EVENT_COLORS } from '@/types/calendar';
import { Task } from '@prisma/client';

/**
 * Syncs a task to Google Calendar (create or update)
 * Direction: App → Google Calendar
 */
export async function syncTaskToCalendar(
  userId: string,
  taskId: string
): Promise<{ success: boolean; googleEventId?: string; error?: string }> {
  try {
    const calendar = await getGoogleCalendarClient(userId);
    if (!calendar) {
      return { success: false, error: 'Calendar client not available' };
    }

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
      return { success: false, error: 'Task not found' };
    }

    // Build event from task
    const event = buildEventFromTask(task, settings.includeFullDetails, settings.excludeFinancialData);

    // Create or update event
    if (task.googleCalendarEventId) {
      // Update existing event
      try {
        const response = await calendar.events.update({
          calendarId: settings.primaryCalendarId,
          eventId: task.googleCalendarEventId,
          requestBody: event,
        });

        await prisma.task.update({
          where: { id: taskId },
          data: {
            syncedToCalendar: true,
            lastSyncedAt: new Date(),
          },
        });

        return { success: true, googleEventId: response.data.id ?? undefined };
      } catch (error) {
        console.error('Error updating event:', error);
        return { success: false, error: 'Failed to update event' };
      }
    } else {
      // Create new event
      try {
        const response = await calendar.events.insert({
          calendarId: settings.primaryCalendarId,
          requestBody: event,
        });

        await prisma.task.update({
          where: { id: taskId },
          data: {
            googleCalendarEventId: response.data.id || null,
            syncedToCalendar: true,
            lastSyncedAt: new Date(),
          },
        });

        return { success: true, googleEventId: response.data.id ?? undefined };
      } catch (error) {
        console.error('Error creating event:', error);
        return { success: false, error: 'Failed to create event' };
      }
    }
  } catch (error) {
    console.error('Error syncing task to calendar:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Deletes a task from Google Calendar
 * Direction: App → Google Calendar
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
      return { success: false, error: 'Calendar not configured' };
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task || task.userId !== userId || !task.googleCalendarEventId) {
      return { success: true }; // Nothing to delete
    }

    try {
      await calendar.events.delete({
        calendarId: settings.primaryCalendarId,
        eventId: task.googleCalendarEventId,
      });

      await prisma.task.update({
        where: { id: taskId },
        data: {
          googleCalendarEventId: null,
          syncedToCalendar: false,
        },
      });

      return { success: true };
    } catch (error) {
      console.error('Error deleting event from calendar:', error);
      return { success: false, error: 'Failed to delete event' };
    }
  } catch (error) {
    console.error('Error deleting task from calendar:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Moves a task to the archived calendar
 * Direction: App → Google Calendar
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

    if (!settings || !settings.primaryCalendarId || !settings.archivedCalendarId) {
      return { success: false, error: 'Calendars not configured' };
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { parse: true },
    });

    if (!task || task.userId !== userId || !task.googleCalendarEventId) {
      return { success: true }; // Nothing to archive
    }

    try {
      // Move event to archived calendar
      const movedEvent = await calendar.events.move({
        calendarId: settings.primaryCalendarId,
        eventId: task.googleCalendarEventId,
        destination: settings.archivedCalendarId,
      });

      await prisma.task.update({
        where: { id: taskId },
        data: {
          lastSyncedAt: new Date(),
        },
      });

      return { success: true };
    } catch (error) {
      console.error('Error moving event to archived calendar:', error);
      return { success: false, error: 'Failed to archive event' };
    }
  } catch (error) {
    console.error('Error archiving task in calendar:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Performs initial sync: pushes all existing tasks to Google Calendar
 */
export async function performInitialSync(userId: string): Promise<SyncResult> {
  const operations: SyncOperation[] = [];
  let totalSynced = 0;
  let totalErrors = 0;

  try {
    const settings = await prisma.calendarSettings.findUnique({
      where: { userId },
    });

    if (!settings || !settings.syncEnabled || !settings.primaryCalendarId) {
      return {
        success: false,
        operations,
        totalSynced,
        totalErrors,
        error: 'Calendar sync not configured',
      };
    }

    // Get all non-archived timeline tasks only
    const tasks = await prisma.task.findMany({
      where: {
        userId,
        archived: false,
        taskTypes: {
          has: 'timeline', // Only sync timeline tasks automatically
        },
      },
    });

    // Sync each timeline task
    for (const task of tasks) {
      const result = await syncTaskToCalendar(userId, task.id);

      operations.push({
        type: 'create',
        taskId: task.id,
        googleEventId: result.googleEventId,
        success: result.success,
        error: result.error,
      });

      if (result.success) {
        totalSynced++;
      } else {
        totalErrors++;
      }
    }

    // Mark initial sync as completed
    await prisma.calendarSettings.update({
      where: { userId },
      data: {
        initialSyncCompleted: true,
        lastSyncAt: new Date(),
      },
    });

    return {
      success: totalErrors === 0,
      operations,
      totalSynced,
      totalErrors,
    };
  } catch (error) {
    console.error('Error performing initial sync:', error);
    return {
      success: false,
      operations,
      totalSynced,
      totalErrors,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Builds a Google Calendar event from a Task
 */
function buildEventFromTask(
  task: Task & { parse?: any },
  includeFullDetails: boolean,
  excludeFinancialData: boolean
): GoogleCalendarEvent {
  const startDate = new Date(task.dueDate);
  const endDate = new Date(task.dueDate);
  endDate.setHours(23, 59, 59, 999); // End of day

  // Build title with [TC Helper] prefix
  const title = `[TC Helper] ${task.title}`;

  // Build description
  let description = '';
  if (includeFullDetails) {
    if (task.description) {
      description += `${task.description}\n\n`;
    }
    if (task.propertyAddress) {
      description += `Property: ${task.propertyAddress}\n`;
    }
    if (task.amount && !excludeFinancialData) {
      description += `Amount: $${task.amount.toLocaleString()}\n`;
    }
    description += `Status: ${task.status}\n`;
    description += `Task Types: ${task.taskTypes.join(', ')}\n`;
  }

  // Determine color based on task type and status
  let colorId: string = EVENT_COLORS.CUSTOM;
  if (task.status === 'completed') {
    colorId = EVENT_COLORS.TIMELINE; // Blue for completed
  } else if (new Date(task.dueDate) < new Date()) {
    colorId = EVENT_COLORS.OVERDUE; // Red for overdue
  } else if (task.taskTypes.includes('timeline')) {
    colorId = EVENT_COLORS.TIMELINE;
  } else if (task.taskTypes.includes('broker')) {
    colorId = EVENT_COLORS.BROKER;
  } else if (task.taskTypes.includes('escrow')) {
    colorId = EVENT_COLORS.ESCROW;
  } else if (task.taskTypes.includes('lender')) {
    colorId = EVENT_COLORS.LENDER;
  }

  return {
    summary: title,
    description: description.trim() || undefined,
    start: {
      date: startDate.toISOString().split('T')[0], // All-day event
    },
    end: {
      date: endDate.toISOString().split('T')[0],
    },
    colorId,
    extendedProperties: {
      private: {
        tcHelperId: task.id,
        tcHelperType: task.timelineEventId ? 'timeline' : 'task',
        tcHelperParseId: task.parseId || undefined,
      },
    },
  };
}
