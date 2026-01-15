// src/lib/tasks/sync-timeline-tasks.ts
// Syncs timeline events to Task records

import { db } from '@/lib/prisma';
import { extractTimelineEvents, TimelineEvent } from '@/lib/dates/extract-timeline-events';
import { TASK_TYPES, TASK_STATUS, mapTimelineStatusToTaskStatus } from '@/types/task';

/**
 * Syncs timeline events from a parse to Task records
 * This ensures the Tasks page always shows the latest timeline data
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
 * These are AI-generated tasks based on timeline events
 */
async function syncDefaultTasks(parseId: string, userId: string, parse: any): Promise<void> {
  // Extract dates from structured timeline data (or fallback to legacy fields)
  const timelineData = parse.timelineDataStructured || {};

  // Helper to get date from timeline data
  const getTimelineDate = (eventKey: string): Date | null => {
    const event = timelineData[eventKey];
    if (!event?.effectiveDate) return null;
    const date = new Date(event.effectiveDate);
    return isNaN(date.getTime()) ? null : date;
  };

  // Helper to check if event is waived
  const isWaived = (eventKey: string): boolean => {
    return timelineData[eventKey]?.waived === true;
  };

  // Get key dates
  const acceptanceDate = getTimelineDate('acceptance') || (parse.effectiveDate ? new Date(parse.effectiveDate) : null);
  const closingDate = getTimelineDate('closing') || (parse.closingDate ? new Date(parse.closingDate) : null);
  const initialDepositDate = getTimelineDate('initialDeposit');
  const inspectionDate = getTimelineDate('inspectionContingency');
  const appraisalDate = getTimelineDate('appraisalContingency');
  const loanDate = getTimelineDate('loanContingency');

  // Default task 1: Escrow Opened - due 1 business day after acceptance
  if (acceptanceDate) {
    const escrowOpenedEventId = `${parseId}-escrow-opened`;
    const escrowOpenedDueDate = addBusinessDays(acceptanceDate, 1);

    await upsertDefaultTask(parseId, userId, parse, {
      timelineEventId: escrowOpenedEventId,
      title: 'Escrow Opened',
      description: 'Escrow should be opened within 1 business day of acceptance',
      taskTypes: [TASK_TYPES.ESCROW],
      dueDate: escrowOpenedDueDate,
    });
  }

  // Default task 2: Broker file approved - due 7 days before closing
  if (closingDate) {
    const brokerFileEventId = `${parseId}-broker-file-approved`;
    const brokerFileDueDate = new Date(closingDate);
    brokerFileDueDate.setDate(brokerFileDueDate.getDate() - 7);

    await upsertDefaultTask(parseId, userId, parse, {
      timelineEventId: brokerFileEventId,
      title: 'Broker file approved',
      description: 'Broker file should be approved at least 7 days before closing',
      taskTypes: [TASK_TYPES.BROKER],
      dueDate: brokerFileDueDate,
    });
  }

  // Default task 3: Initial Deposit - if not waived
  if (initialDepositDate && !isWaived('initialDeposit')) {
    const initialDepositEventId = `${parseId}-initial-deposit`;

    await upsertDefaultTask(parseId, userId, parse, {
      timelineEventId: initialDepositEventId,
      title: 'Initial Deposit Due',
      description: 'Submit initial earnest money deposit',
      taskTypes: [TASK_TYPES.ESCROW],
      dueDate: initialDepositDate,
      amount: parse.earnestMoneyDeposit?.amount || null,
    });
  }

  // Default task 4: Inspection Contingency - if not waived
  if (inspectionDate && !isWaived('inspectionContingency')) {
    const inspectionEventId = `${parseId}-inspection-contingency`;

    await upsertDefaultTask(parseId, userId, parse, {
      timelineEventId: inspectionEventId,
      title: 'Inspection Contingency',
      description: 'Complete inspections and remove inspection contingency',
      taskTypes: [TASK_TYPES.TIMELINE],
      dueDate: inspectionDate,
    });
  }

  // Default task 5: Appraisal Contingency - if not waived
  if (appraisalDate && !isWaived('appraisalContingency')) {
    const appraisalEventId = `${parseId}-appraisal-contingency`;

    await upsertDefaultTask(parseId, userId, parse, {
      timelineEventId: appraisalEventId,
      title: 'Appraisal Contingency',
      description: 'Complete appraisal and remove appraisal contingency',
      taskTypes: [TASK_TYPES.LENDER],
      dueDate: appraisalDate,
    });
  }

  // Default task 6: Loan Contingency - if not waived
  if (loanDate && !isWaived('loanContingency')) {
    const loanEventId = `${parseId}-loan-contingency`;

    await upsertDefaultTask(parseId, userId, parse, {
      timelineEventId: loanEventId,
      title: 'Loan Contingency',
      description: 'Secure loan approval and remove loan contingency',
      taskTypes: [TASK_TYPES.LENDER],
      dueDate: loanDate,
    });
  }
}

/**
 * Helper function to upsert a default task
 */
async function upsertDefaultTask(
  parseId: string,
  userId: string,
  parse: any,
  taskInfo: {
    timelineEventId: string;
    title: string;
    description: string;
    taskTypes: string[];
    dueDate: Date;
    amount?: number | null;
  }
): Promise<void> {
  const existingTask = await db.task.findFirst({
    where: {
      parseId,
      timelineEventId: taskInfo.timelineEventId,
    },
  });

  const taskData = {
    userId,
    parseId,
    taskTypes: taskInfo.taskTypes,
    timelineEventId: taskInfo.timelineEventId,
    title: taskInfo.title,
    description: taskInfo.description,
    propertyAddress: parse.propertyAddress || null,
    amount: taskInfo.amount || null,
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
    await db.task.update({
      where: { id: existingTask.id },
      data: taskData,
    });
  } else {
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
