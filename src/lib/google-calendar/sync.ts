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
      } catch (err: any) {
        // If event was deleted in Google, create a new one instead
        if (err.code === 404) {
          const response = await calendar.events.insert({
            calendarId: settings.primaryCalendarId,
            requestBody: eventBody,
          });
          googleEventId = response.data.id || null;
        } else {
          throw err;
        }
      }
    } else {
      // CREATE new event
      const response = await calendar.events.insert({
        calendarId: settings.primaryCalendarId,
        requestBody: eventBody,
      });
      googleEventId = response.data.id || null;
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
 * Helper to transform a Task object into a Google Calendar Event
 */
function buildEventFromTask(
  task: any, 
  includeDetails: boolean, 
  excludeFinancial: boolean
): calendar_v3.Schema$Event {
  const title = `[${task.parse?.propertyAddress || 'Task'}] ${task.title}`;
  
  let description = '';
  if (includeDetails) {
    description += `${task.description || ''}\n\n`;
    description += `Status: ${task.status}\n`;
    if (task.amount && !excludeFinancial) {
      description += `Amount: $${task.amount}\n`;
    }
    description += `View in App: ${process.env.NEXT_PUBLIC_APP_URL}/tasks/${task.id}`;
  }

  // Choose Google Color based on status/type
  let colorId = EVENT_COLORS.TIMELINE; // Default Blue
  if (task.status === 'completed') {
    colorId = '8'; // Gray in Google
  } else if (new Date(task.dueDate) < new Date() && task.status !== 'completed') {
    colorId = '11'; // Red for overdue
  }

  const dateStr = new Date(task.dueDate).toISOString().split('T')[0];

  return {
    summary: title,
    description: description.trim(),
    colorId: colorId,
    start: { date: dateStr }, // All-day event
    end: { date: dateStr },
    extendedProperties: {
      private: {
        appTaskId: task.id,
        parseId: task.parseId || '',
      }
    }
  };
}