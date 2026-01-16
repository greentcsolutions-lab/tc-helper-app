// src/lib/tasks/sync-timeline-tasks.ts
// Syncs timeline events to Task records

import { db } from '@/lib/prisma';
import { extractTimelineEvents, TimelineEvent } from '@/lib/dates/extract-timeline-events';
import { TASK_TYPES, TASK_STATUS, mapTimelineStatusToTaskStatus } from '@/types/task';
import { syncTaskToCalendar } from '@/lib/google-calendar/sync';
import { syncTimelineEventsToCalendar } from '@/lib/google-calendar/sync-timeline-events';

/**
 * Syncs default AI-generated tasks from a parse to Task records
 * Only creates tasks defined in the user's AI template
 *
 * @param parseId - The parse ID to sync
 * @param userId - The user ID who owns this parse
 */
export async function syncTimelineTasks(parseId: string, userId: string): Promise<void> {
  // Fetch the parse with necessary fields
  const parse = await db.parse.findUnique({
    where: { id: parseId },
    select: {
      id: true,
      userId: true,
      propertyAddress: true,
      effectiveDate: true,
      closingDate: true,
      initialDepositDueDate: true,
      sellerDeliveryOfDisclosuresDate: true,
      contingencies: true,
      earnestMoneyDeposit: true,
      status: true,
      timelineDataStructured: true,
    },
  });

  if (!parse || parse.userId !== userId) {
    throw new Error('Parse not found or unauthorized');
  }

  // Don't sync tasks for archived transactions
  if (parse.status === 'ARCHIVED') {
    return;
  }

  // Create default AI-generated tasks based on template
  await syncDefaultTasks(parseId, userId, parse);

  // Sync all timeline events to Google Calendar
  // This ensures the calendar is a mirror of the timeline view
  syncTimelineEventsToCalendar(parseId, userId).catch((error) => {
    console.error('Failed to sync timeline events to calendar:', error);
    // Don't fail the request if calendar sync fails
  });
}

/**
 * Adds business days to a date (skips weekends)
 */
function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let daysAdded = 0;

  while (daysAdded < days) {
    result.setDate(result.getDate() + 1);
    // Skip weekends (0 = Sunday, 6 = Saturday)
    if (result.getDay() !== 0 && result.getDay() !== 6) {
      daysAdded++;
    }
  }

  return result;
}

/**
 * Syncs ALL timeline events to tasks
 * Creates a task for every event in timelineDataStructured
 */
async function syncDefaultTasks(parseId: string, userId: string, parse: any): Promise<void> {
  // Extract dates from structured timeline data
  const timelineData = parse.timelineDataStructured || {};

  console.log(`[syncDefaultTasks] Processing ${Object.keys(timelineData).length} timeline events for parse ${parseId}`);

  // Iterate through all timeline events and create tasks
  for (const [eventKey, eventData] of Object.entries(timelineData)) {
    const event = eventData as any;

    // Skip if no effective date
    if (!event?.effectiveDate) {
      console.log(`[syncDefaultTasks] Skipping ${eventKey} - no effective date`);
      continue;
    }

    // Skip if waived
    if (event.waived === true) {
      console.log(`[syncDefaultTasks] Skipping ${eventKey} - waived`);
      continue;
    }

    // Parse the date
    const dueDate = new Date(event.effectiveDate);
    if (isNaN(dueDate.getTime())) {
      console.log(`[syncDefaultTasks] Skipping ${eventKey} - invalid date: ${event.effectiveDate}`);
      continue;
    }

    // Determine the display name
    const displayName = event.displayName || eventKey;

    // Determine task types based on event key
    const taskTypes = determineTaskTypes(eventKey);

    console.log(`[syncDefaultTasks] Creating/updating task for ${eventKey}: "${displayName}" due ${dueDate.toISOString()}`);

    // Create or update the task
    await upsertTimelineTask(parseId, userId, parse, {
      timelineEventKey: eventKey,
      timelineEventId: `${parseId}-${eventKey}`,
      title: displayName,
      description: event.description || null,
      taskTypes,
      dueDate,
    });
  }
}

/**
 * Determines appropriate task types based on the event key
 */
function determineTaskTypes(eventKey: string): string[] {
  // Always include 'timeline' for all timeline events
  const types = [TASK_TYPES.TIMELINE];

  // Add specific categories based on event name
  if (eventKey.toLowerCase().includes('contingency')) {
    // Don't add additional types for contingencies
  } else if (eventKey.toLowerCase().includes('deposit') || eventKey.toLowerCase().includes('escrow')) {
    types.push(TASK_TYPES.ESCROW);
  } else if (eventKey.toLowerCase().includes('loan') || eventKey.toLowerCase().includes('appraisal')) {
    types.push(TASK_TYPES.LENDER);
  } else if (eventKey.toLowerCase().includes('broker')) {
    types.push(TASK_TYPES.BROKER);
  }

  return types;
}

/**
 * Helper function to upsert a timeline task
 */
async function upsertTimelineTask(
  parseId: string,
  userId: string,
  parse: any,
  taskInfo: {
    timelineEventKey: string;
    timelineEventId: string;
    title: string;
    description: string | null;
    taskTypes: string[];
    dueDate: Date;
  }
): Promise<void> {
  // Find existing task by parseId + timelineEventKey (not timelineEventId)
  const existingTask = await db.task.findFirst({
    where: {
      parseId,
      timelineEventKey: taskInfo.timelineEventKey,
    },
  });

  const taskData = {
    userId,
    parseId,
    taskTypes: taskInfo.taskTypes,
    timelineEventId: taskInfo.timelineEventId,
    timelineEventKey: taskInfo.timelineEventKey,
    title: taskInfo.title,
    description: taskInfo.description,
    propertyAddress: parse.propertyAddress || null,
    dueDate: taskInfo.dueDate,
    dueDateType: 'specific' as const,
    dueDateValue: null,
    status: existingTask?.status || TASK_STATUS.NOT_STARTED,
    columnId: existingTask?.columnId || TASK_STATUS.NOT_STARTED,
    sortOrder: existingTask?.sortOrder || 0,
    isCustom: false,
    completedAt: existingTask?.completedAt || null,
  };

  if (existingTask) {
    console.log(`[upsertTimelineTask] Updating existing task ${existingTask.id} for ${taskInfo.timelineEventKey}`);
    await db.task.update({
      where: { id: existingTask.id },
      data: taskData,
    });
  } else {
    console.log(`[upsertTimelineTask] Creating new task for ${taskInfo.timelineEventKey}`);
    await db.task.create({
      data: taskData,
    });
  }
}

/**
 * Syncs timeline tasks for all parses owned by a user
 */
export async function syncAllTimelineTasks(userId: string): Promise<void> {
  const parses = await db.parse.findMany({
    where: {
      userId,
      status: { in: ['COMPLETED', 'NEEDS_REVIEW'] },
    },
    select: { id: true },
  });

  for (const parse of parses) {
    await syncTimelineTasks(parse.id, userId);
  }
}

/**
 * Determines which task types (categories) should be assigned to a timeline event
 * Some events belong to multiple categories
 */
function getEventTaskTypes(event: TimelineEvent): string[] {
  const types = [TASK_TYPES.TIMELINE]; // All timeline events have TIMELINE category

  // Add additional categories based on event type/title
  if (event.type === 'contingency') {
    if (event.title.includes('Loan')) {
      types.push(TASK_TYPES.LENDER); // Loan contingency is also a LENDER task
    } else if (event.title.includes('Appraisal')) {
      types.push(TASK_TYPES.LENDER); // Appraisal contingency is also a LENDER task
    }
  } else if (event.type === 'closing') {
    types.push(TASK_TYPES.ESCROW); // Closing is also an ESCROW task
  }

  return types;
}

/**
 * Gets a description for a timeline event
 */
function getEventDescription(event: TimelineEvent): string | null {
  switch (event.type) {
    case 'acceptance':
      return 'Contract acceptance date - workflow start';
    case 'deposit':
      return 'Initial earnest money deposit due';
    case 'deadline':
      return 'Important deadline';
    case 'contingency':
      if (event.title.includes('Loan')) {
        return 'Loan contingency removal deadline';
      } else if (event.title.includes('Appraisal')) {
        return 'Appraisal contingency removal deadline';
      } else if (event.title.includes('Investigation')) {
        return 'Investigation contingency removal deadline';
      }
      return 'Contingency removal deadline';
    case 'closing':
      return 'Close of escrow';
    default:
      return null;
  }
}

/**
 * Gets the amount associated with an event (if applicable)
 */
function getEventAmount(event: TimelineEvent, parse: any): number | null {
  if (event.type === 'deposit' && parse.earnestMoneyDeposit) {
    return parse.earnestMoneyDeposit.amount || null;
  }
  return null;
}

/**
 * Updates timeline when a task with TIMELINE category is modified
 * This syncs task changes back to the timeline data
 */
export async function syncTaskToTimeline(taskId: string): Promise<void> {
  // Get the task
  const task = await db.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      parseId: true,
      timelineEventId: true,
      taskTypes: true,
      dueDate: true,
    },
  });

  if (!task || !task.parseId || !task.timelineEventId) {
    return;
  }

  // Only sync back if task has TIMELINE category
  if (!task.taskTypes.includes(TASK_TYPES.TIMELINE)) {
    return;
  }

  // Map timelineEventId back to timeline event key
  // Format is "{parseId}-{eventKey}"
  const eventKey = task.timelineEventId.replace(`${task.parseId}-`, '');

  // Get the parse
  const parse = await db.parse.findUnique({
    where: { id: task.parseId },
    select: {
      id: true,
      timelineDataStructured: true,
    },
  });

  if (!parse || !parse.timelineDataStructured) {
    return;
  }

  const timelineData = parse.timelineDataStructured as any;

  // Check if this event exists in timeline
  if (!timelineData[eventKey]) {
    return;
  }

  // Format date as YYYY-MM-DD for timeline
  const updatedDate = task.dueDate.toISOString().split('T')[0];

  // Update the effectiveDate in timeline
  timelineData[eventKey].effectiveDate = updatedDate;

  // If it was a relative date, mark it as specified now
  if (timelineData[eventKey].dateType === 'relative') {
    timelineData[eventKey].dateType = 'specified';
    timelineData[eventKey].specifiedDate = updatedDate;
  }

  // Save back to database
  await db.parse.update({
    where: { id: task.parseId },
    data: {
      timelineDataStructured: timelineData,
    },
  });
}

/**
 * Deletes all timeline tasks for a parse (used when parse is deleted/archived)
 */
export async function deleteTimelineTasks(parseId: string): Promise<void> {
  await db.task.deleteMany({
    where: {
      parseId,
      taskTypes: {
        has: TASK_TYPES.TIMELINE,
      },
    },
  });
}
