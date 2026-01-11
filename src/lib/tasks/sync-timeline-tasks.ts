// src/lib/tasks/sync-timeline-tasks.ts
// Syncs timeline events to Task records

import { db } from '@/lib/prisma';
import { extractTimelineEvents, TimelineEvent } from '@/lib/dates/extract-timeline-events';
import { TASK_TYPES, TASK_STATUS, mapTimelineStatusToTaskStatus } from '@/types/task';
import { areAITasksEnabled } from '@/lib/tasks/ai-tasks-template';

/**
 * Syncs timeline events from a parse to Task records
 * This ensures the Tasks page always shows the latest timeline data
 *
 * @param parseId - The parse ID to sync
 * @param userId - The user ID who owns this parse
 */
export async function syncTimelineTasks(parseId: string, userId: string): Promise<void> {
  // Check if AI tasks are enabled for this user
  const aiTasksEnabled = await areAITasksEnabled(userId);
  if (!aiTasksEnabled) {
    // If AI tasks are disabled, don't generate any tasks
    return;
  }
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
    },
  });

  if (!parse || parse.userId !== userId) {
    throw new Error('Parse not found or unauthorized');
  }

  // Don't sync tasks for archived transactions
  if (parse.status === 'ARCHIVED') {
    return;
  }

  // Extract timeline events
  const timelineEvents = extractTimelineEvents(parse);

  // Get existing timeline tasks for this parse (tasks that include TIMELINE in their taskTypes)
  const existingTasks = await db.task.findMany({
    where: {
      parseId,
      taskTypes: {
        has: TASK_TYPES.TIMELINE,
      },
    },
  });

  // Create a map of existing tasks by timelineEventId
  const existingTaskMap = new Map(
    existingTasks.map(task => [task.timelineEventId, task])
  );

  // Track which timeline events we've processed
  const processedEventIds = new Set<string>();

  // Upsert tasks for each timeline event (skip acceptance events)
  for (const event of timelineEvents) {
    // Skip acceptance events - they're not actionable tasks
    if (event.type === 'acceptance') {
      continue;
    }

    processedEventIds.add(event.id);

    const existingTask = existingTaskMap.get(event.id);
    const taskStatus = mapTimelineStatusToTaskStatus(event.status);

    // Determine task types based on the event
    const taskTypes = getEventTaskTypes(event);

    const taskData = {
      userId,
      parseId,
      taskTypes, // Array of task types (can have multiple categories)
      timelineEventId: event.id,
      title: event.title,
      description: getEventDescription(event),
      propertyAddress: event.propertyAddress || null,
      amount: getEventAmount(event, parse),
      dueDate: event.start,
      dueDateType: 'specific' as const,
      dueDateValue: null,
      status: existingTask?.status === TASK_STATUS.COMPLETED
        ? TASK_STATUS.COMPLETED // Preserve completed status
        : taskStatus,
      columnId: existingTask?.columnId || taskStatus,
      sortOrder: existingTask?.sortOrder || 0,
      isCustom: false,
      completedAt: existingTask?.completedAt || null,
    };

    if (existingTask) {
      // Update existing task
      await db.task.update({
        where: { id: existingTask.id },
        data: taskData,
      });
    } else {
      // Create new task
      await db.task.create({
        data: taskData,
      });
    }
  }

  // Delete timeline tasks that no longer have corresponding timeline events
  const taskIdsToDelete = existingTasks
    .filter(task => !processedEventIds.has(task.timelineEventId || ''))
    .map(task => task.id);

  if (taskIdsToDelete.length > 0) {
    await db.task.deleteMany({
      where: {
        id: { in: taskIdsToDelete },
      },
    });
  }

  // Create default tasks (Escrow Opened and Broker file approved)
  await syncDefaultTasks(parseId, userId, parse);
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
 * Syncs default tasks that should be created for every parse
 */
async function syncDefaultTasks(parseId: string, userId: string, parse: any): Promise<void> {
  const effectiveDate = parse.effectiveDate ? new Date(parse.effectiveDate) : null;
  const closingDate = parse.closingDate ? new Date(parse.closingDate) : null;

  // Default task 1: Escrow Opened - due 1 business day after acceptance
  if (effectiveDate) {
    const escrowOpenedEventId = `${parseId}-escrow-opened`;
    const escrowOpenedDueDate = addBusinessDays(effectiveDate, 1);

    const existingEscrowTask = await db.task.findFirst({
      where: {
        parseId,
        timelineEventId: escrowOpenedEventId,
      },
    });

    const escrowTaskData = {
      userId,
      parseId,
      taskTypes: [TASK_TYPES.ESCROW, TASK_TYPES.AI],
      timelineEventId: escrowOpenedEventId,
      title: 'Escrow Opened',
      description: 'Escrow should be opened within 1 business day of acceptance',
      propertyAddress: parse.propertyAddress || null,
      amount: null,
      dueDate: escrowOpenedDueDate,
      dueDateType: 'specific' as const,
      dueDateValue: null,
      status: existingEscrowTask?.status || TASK_STATUS.NOT_STARTED,
      columnId: existingEscrowTask?.columnId || TASK_STATUS.NOT_STARTED,
      sortOrder: existingEscrowTask?.sortOrder || 0,
      isCustom: false,
      completedAt: existingEscrowTask?.completedAt || null,
    };

    if (existingEscrowTask) {
      await db.task.update({
        where: { id: existingEscrowTask.id },
        data: escrowTaskData,
      });
    } else {
      await db.task.create({
        data: escrowTaskData,
      });
    }
  }

  // Default task 2: Broker file approved - due 7 days before closing
  if (closingDate) {
    const brokerFileEventId = `${parseId}-broker-file-approved`;
    const brokerFileDueDate = new Date(closingDate);
    brokerFileDueDate.setDate(brokerFileDueDate.getDate() - 7);

    const existingBrokerTask = await db.task.findFirst({
      where: {
        parseId,
        timelineEventId: brokerFileEventId,
      },
    });

    const brokerTaskData = {
      userId,
      parseId,
      taskTypes: [TASK_TYPES.BROKER, TASK_TYPES.AI],
      timelineEventId: brokerFileEventId,
      title: 'Broker file approved',
      description: 'Broker file should be approved at least 7 days before closing',
      propertyAddress: parse.propertyAddress || null,
      amount: null,
      dueDate: brokerFileDueDate,
      dueDateType: 'specific' as const,
      dueDateValue: null,
      status: existingBrokerTask?.status || TASK_STATUS.NOT_STARTED,
      columnId: existingBrokerTask?.columnId || TASK_STATUS.NOT_STARTED,
      sortOrder: existingBrokerTask?.sortOrder || 0,
      isCustom: false,
      completedAt: existingBrokerTask?.completedAt || null,
    };

    if (existingBrokerTask) {
      await db.task.update({
        where: { id: existingBrokerTask.id },
        data: brokerTaskData,
      });
    } else {
      await db.task.create({
        data: brokerTaskData,
      });
    }
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
  const types = [TASK_TYPES.TIMELINE, TASK_TYPES.AI]; // All timeline events have TIMELINE and AI categories

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
