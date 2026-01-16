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

      if (!event.id) {
        console.log(`[Calendar→App] Skipping event with no ID`);
        continue;
      }

      // Check if this is an app-created event
      const hasTaskId = !!event.extendedProperties?.private?.tcHelperTaskId;
      const hasLegacyId = !!event.extendedProperties?.private?.tcHelperId;
      const hasParseId = !!event.extendedProperties?.private?.tcHelperParseId;
      const hasPrefix = event.summary?.startsWith('[TC Helper]');

      const isAppEvent = hasTaskId || hasLegacyId || hasParseId || hasPrefix;

      console.log(`[Calendar→App] Processing event "${event.summary}" (ID: ${event.id})`);
      console.log(`[Calendar→App]   isAppEvent: ${isAppEvent} (taskId: ${hasTaskId}, legacyId: ${hasLegacyId}, parseId: ${hasParseId}, prefix: ${hasPrefix})`);

      if (isAppEvent) {
        // This is an app event - sync changes back to task
        console.log(`[Calendar→App]   → App event - syncing changes back to task`);
        await syncAppEventChanges(userId, event);
        totalUpdated++;
      } else {
        // This is an external event - check if it should be synced
        console.log(`[Calendar→App]   → External event - checking if should sync`);
        const shouldSync = await shouldSyncExternalEvent(userId, event);
        console.log(`[Calendar→App]   → shouldSync result: ${shouldSync}`);

        if (shouldSync) {
          console.log(`[Calendar→App]   → Syncing external event to app`);
          await syncExternalEvent(userId, event);
          totalCreated++;
        } else {
          console.log(`[Calendar→App]   → Not syncing - storing as non-app event for display`);
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
 * Syncs changes from a Google Calendar event back to the corresponding task
 * Now we only update TASKS, not timelineDataStructured (which is immutable)
 */
async function syncAppEventChanges(
  userId: string,
  event: calendar_v3.Schema$Event
): Promise<void> {
  // Get taskId from new extended property format
  const taskId = event.extendedProperties?.private?.tcHelperTaskId;

  // Parse dates
  const startDate = event.start?.date || event.start?.dateTime;
  if (!startDate) return;

  // Extract title (no [TC Helper] prefix in new system, but handle legacy)
  let title = event.summary || '';
  if (title.startsWith('[TC Helper] ')) {
    title = title.substring(12);
  }

  // Update task if we have a taskId
  if (taskId) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        userId: true,
        description: true,
      },
    });

    if (task && task.userId === userId) {
      console.log(`[syncAppEventChanges] Updating task ${taskId} from calendar event`);
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
    } else {
      console.log(`[syncAppEventChanges] Task ${taskId} not found or unauthorized`);
    }
  } else {
    // Legacy event without tcHelperTaskId - try to find by old properties
    const legacyTaskId = event.extendedProperties?.private?.tcHelperId;
    const parseId = event.extendedProperties?.private?.tcHelperParseId;
    const eventKey = event.extendedProperties?.private?.tcHelperTimelineEventKey;

    if (legacyTaskId) {
      // Old format with task ID
      const task = await prisma.task.findUnique({
        where: { id: legacyTaskId },
        select: {
          id: true,
          userId: true,
          description: true,
        },
      });

      if (task && task.userId === userId) {
        console.log(`[syncAppEventChanges] Updating legacy task ${legacyTaskId}`);
        await prisma.task.update({
          where: { id: legacyTaskId },
          data: {
            title,
            dueDate: new Date(startDate),
            description: event.description || task.description,
            lastSyncedAt: new Date(),
          },
        });
      }
    } else if (parseId && eventKey) {
      // Old timeline format - find task by parseId + timelineEventKey
      const task = await prisma.task.findFirst({
        where: {
          parseId,
          timelineEventKey: eventKey,
          userId,
        },
        select: {
          id: true,
          description: true,
        },
      });

      if (task) {
        console.log(`[syncAppEventChanges] Updating task via parseId+eventKey: ${task.id}`);
        await prisma.task.update({
          where: { id: task.id },
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

  console.log(`[shouldSync] ================================================`);
  console.log(`[shouldSync] Evaluating external event: "${title}"`);
  console.log(`[shouldSync] Event ID: ${event.id}`);
  console.log(`[shouldSync] Description: "${description}"`);
  console.log(`[shouldSync] Search text: "${searchText}"`);

  // Try to match property address
  const match = await matchPropertyAddress(userId, searchText);

  console.log(`[shouldSync] Property match result:`);
  console.log(`[shouldSync]   - Confidence: ${match.confidence}`);
  console.log(`[shouldSync]   - Property: ${match.propertyAddress || 'none'}`);
  console.log(`[shouldSync]   - Parse ID: ${match.parseId || 'none'}`);
  console.log(`[shouldSync]   - Match score: ${match.matchScore}`);

  const shouldSync = match.confidence !== 'none';
  console.log(`[shouldSync] DECISION: ${shouldSync ? 'SYNC' : 'DO NOT SYNC'}`);
  console.log(`[shouldSync] ================================================`);

  return shouldSync;
}

/**
 * Creates a task from an external calendar event
 */
async function syncExternalEvent(
  userId: string,
  event: calendar_v3.Schema$Event
): Promise<void> {
  console.log(`[syncExternalEvent] Starting sync for event: ${event.summary} (${event.id})`);

  if (!event.id || !event.start) {
    console.log(`[syncExternalEvent] Missing event ID or start date - skipping`);
    return;
  }

  // Check if we've already synced this event
  const existingEvent = await prisma.calendarEvent.findUnique({
    where: { googleEventId: event.id },
  });

  if (existingEvent && existingEvent.isAppEvent) {
    console.log(`[syncExternalEvent] Event already synced as app event - skipping`);
    return; // Already synced
  }

  console.log(`[syncExternalEvent] Event not yet synced - proceeding with creation`);

  const title = event.summary || 'Untitled Event';
  const description = event.description || null;
  const startDate = event.start.date || event.start.dateTime;

  console.log(`[syncExternalEvent] Title: ${title}`);
  console.log(`[syncExternalEvent] Start date: ${startDate}`);

  if (!startDate) {
    console.log(`[syncExternalEvent] No start date - skipping`);
    return;
  }

  // Match property address
  const searchText = `${title} ${description || ''}`.toLowerCase();
  console.log(`[syncExternalEvent] Matching property for: "${searchText}"`);

  const match = await matchPropertyAddress(userId, searchText);

  console.log(`[syncExternalEvent] Property match result: confidence=${match.confidence}, property=${match.propertyAddress}`);

  if (match.confidence === 'none') {
    console.log(`[syncExternalEvent] No property match - skipping task creation`);
    return; // No property match
  }

  // Infer task types (AI for BASIC plan users)
  const user = await prisma.user.findUnique({ where: { id: userId } });
  let taskTypes = ['timeline']; // Default

  console.log(`[syncExternalEvent] User plan: ${(user as any)?.planType || 'unknown'}`);

  // AI inference for BASIC plan users
  if (user && (user as any).planType === 'BASIC') {
    console.log(`[syncExternalEvent] Running AI inference for task types`);
    const inference = await inferTaskTypes(title, description || '', match.propertyAddress);
    taskTypes = inference.taskTypes.length > 0 ? inference.taskTypes : ['timeline'];
    console.log(`[syncExternalEvent] Inferred task types: ${taskTypes.join(', ')}`);
  } else {
    console.log(`[syncExternalEvent] Using default task types: timeline`);
  }

  // Create task and increment custom task count in a transaction
  console.log(`[syncExternalEvent] Creating task in database...`);
  console.log(`[syncExternalEvent]   - Title: ${title}`);
  console.log(`[syncExternalEvent]   - Property: ${match.propertyAddress}`);
  console.log(`[syncExternalEvent]   - ParseId: ${match.parseId || 'none'}`);
  console.log(`[syncExternalEvent]   - Due date: ${startDate}`);
  console.log(`[syncExternalEvent]   - Task types: ${taskTypes.join(', ')}`);

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

    console.log(`[syncExternalEvent] Task created with ID: ${newTask.id}`);

    // Increment custom task count (external events count as custom tasks)
    await tx.user.update({
      where: { id: userId },
      data: { customTaskCount: { increment: 1 } },
    });

    console.log(`[syncExternalEvent] Custom task count incremented`);

    return newTask;
  });

  console.log(`[syncExternalEvent] Transaction completed successfully`);

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
