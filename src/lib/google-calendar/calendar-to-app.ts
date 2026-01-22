// src/lib/google-calendar/calendar-to-app.ts
// Sync Google Calendar events to app tasks using Incremental Sync (Sync Tokens)

import { calendar_v3 } from 'googleapis';
import { getGoogleCalendarClient } from './client';
import { prisma } from '@/lib/prisma';
import { matchPropertyAddress } from './property-matcher';
import { inferTaskTypes } from './ai-inference';
import { TASK_STATUS } from '@/types/task';
import { CalendarEvent } from '@prisma/client';

/**
 * Syncs changes from Google Calendar to the app
 * Optimized for Incremental Sync using syncTokens
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
      throw new Error('Calendar client not available');
    }

    const settings = await prisma.calendarSettings.findUnique({
      where: { userId },
    });

    if (!settings || !settings.primaryCalendarId) {
      throw new Error('Calendar not configured');
    }

    // --- INCREMENTAL SYNC LOGIC ---
    let params: calendar_v3.Params$Resource$Events$List = {
      calendarId: settings.primaryCalendarId,
      singleEvents: true, // Expand recurring events
    };

    // If we have a sync token, use it to get only CHANGES
    if (settings.nextSyncToken) {
      params.syncToken = settings.nextSyncToken;
    } else {
      // First time sync? Or token expired?
      // Limit window to 3 months back/forward to avoid massive initial loads
      const now = new Date();
      params.timeMin = new Date(now.setMonth(now.getMonth() - 3)).toISOString();
    }

    let response;
    try {
      response = await calendar.events.list(params);
    } catch (err: any) {
      // If syncToken is invalid (410 Gone), we must clear it and do a full sync
      if (err.code === 410) {
        console.warn('Sync token expired, performing full sync reset.');
        await prisma.calendarSettings.update({
          where: { userId },
          data: { nextSyncToken: null }
        });
        return syncCalendarToApp(userId); // Recursive call with cleared token
      }
      throw err;
    }

    const items = response.data.items || [];

    console.log(`[Calendar→App Sync] Processing ${items.length} events for user ${userId}`);

    for (const event of items) {
      totalProcessed++;

      // 1. Handle Deleted Events
      if (event.status === 'cancelled') {
        const existingEvent = await prisma.calendarEvent.findUnique({ where: { googleEventId: event.id as string }});
        if (existingEvent) {
            await syncCalendarEventToTask(existingEvent, true);
            await prisma.calendarEvent.delete({ where: { id: existingEvent.id } });
            totalDeleted++;
        }
        continue;
      }

      // 2. Process Active Events
      // All events from our "TC Helper - Transactions" calendar are app events
      // Try to match against property addresses for linking to transactions
      const match = await matchPropertyAddress(userId, `${event.summary} ${event.description || ''}`);

      let taskTypes: string[] = [];

      // Only run AI inference if we found a property match
      if (match.confidence !== 'none' && match.propertyAddress) {
        const inference = await inferTaskTypes(
          event.summary || '',
          event.description || '',
          match.propertyAddress
        );
        taskTypes = inference.taskTypes;
      }
      // Otherwise, taskTypes remains empty array (user can assign in app)

      // 3. Upsert into CalendarEvent table (Our "Mirror" of Google)
      // All events from our calendar are considered app events
      const calendarEvent = await prisma.calendarEvent.upsert({
        where: { googleEventId: event.id as string },
        create: {
          userId,
          googleEventId: event.id as string,
          calendarId: settings.primaryCalendarId,
          title: event.summary || 'No Title',
          description: event.description,
          start: new Date(event.start?.dateTime || event.start?.date || ''),
          end: new Date(event.end?.dateTime || event.end?.date || ''),
          allDay: !!event.start?.date,
          isAppEvent: true, // All events from our calendar are app events
          matchedPropertyAddress: match.propertyAddress || null,
          inferredTaskTypes: taskTypes,
        },
        update: {
          title: event.summary || 'No Title',
          description: event.description,
          start: new Date(event.start?.dateTime || event.start?.date || ''),
          end: new Date(event.end?.dateTime || event.end?.date || ''),
          allDay: !!event.start?.date,
          isAppEvent: true, // All events from our calendar are app events
          matchedPropertyAddress: match.propertyAddress || null,
          inferredTaskTypes: taskTypes,
          lastSyncedAt: new Date(),
        }
      });

      // 4. Sync the mirrored event to a Task
      const { created } = await syncCalendarEventToTask(calendarEvent, false);
      if (created) {
        totalCreated++;
      } else {
        totalUpdated++;
      }
    }

    // 5. Save the new Sync Token for next time
    await prisma.calendarSettings.update({
      where: { userId },
      data: {
        nextSyncToken: response.data.nextSyncToken,
        lastSyncStatus: 'SUCCESS',
        lastSyncedAt: new Date(),
        lastSyncError: null,
        initialSyncCompleted: true
      }
    });

    return { success: true, totalProcessed, totalCreated, totalUpdated, totalDeleted };

  } catch (error: any) {
    console.error('Incremental sync failed:', error);

    // Log error to the memory fields
    await prisma.calendarSettings.update({
      where: { userId },
      data: {
        lastSyncStatus: 'ERROR',
        lastSyncError: error.message || 'Unknown sync error'
      }
    });

    return {
      success: false,
      totalProcessed,
      totalCreated,
      totalUpdated,
      totalDeleted,
      error: error.message
    };
  }
}

/**
 * Creates, updates, or archives a Task based on a CalendarEvent
 * Syncs ALL events from our calendar, not just property-matched ones
 */
async function syncCalendarEventToTask(event: CalendarEvent, isDeletion: boolean): Promise<{ success: boolean, created: boolean }> {
    if (isDeletion) {
        // Archive the task instead of deleting it
        await prisma.task.updateMany({
            where: { googleCalendarEventId: event.googleEventId },
            data: { archived: true }
        });
        return { success: true, created: false };
    }

    // Check if this event already exists as a task
    const existingTask = await prisma.task.findUnique({
        where: { googleCalendarEventId: event.googleEventId }
    });

    // Try to find matching parse (transaction) if property address exists
    let parseId: string | null = null;
    if (event.matchedPropertyAddress) {
        const parse = await prisma.parse.findFirst({
            where: {
                userId: event.userId,
                propertyAddress: event.matchedPropertyAddress,
                status: {
                    not: 'ARCHIVED' // Don't link to archived transactions
                }
            },
            select: { id: true }
        });
        parseId = parse?.id || null;
    }

    const taskData = {
        title: event.title,
        description: event.description || '',
        propertyAddress: event.matchedPropertyAddress || null, // Null for non-property events
        parseId: parseId, // Null if no property match or archived transaction
        dueDate: event.start,
        taskTypes: event.inferredTaskTypes.length > 0 ? event.inferredTaskTypes : [], // Empty array if no match
        status: TASK_STATUS.NOT_STARTED,
        syncedToCalendar: true,
        lastSyncedAt: new Date(),
    };

    if (existingTask) {
        // Update existing task
        await prisma.task.update({
            where: { id: existingTask.id },
            data: taskData
        });
        console.log(`[Calendar→App] Updated task "${event.title}" (parseId: ${parseId || 'none'})`);
        return { success: true, created: false };
    } else {
        // Create new task - ALL events create tasks now
        await prisma.task.create({
            data: {
                ...taskData,
                userId: event.userId,
                googleCalendarEventId: event.googleEventId,
            }
        });
        console.log(`[Calendar→App] Created task "${event.title}" (parseId: ${parseId || 'none'})`);
        return { success: true, created: true };
    }
}