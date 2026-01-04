// src/lib/tasks/sync-timeline-tasks.ts
// Syncs timeline events to Task records

import { prisma } from '@/lib/prisma';
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
  const parse = await prisma.parse.findUnique({
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

  // Get existing timeline tasks for this parse
  const existingTasks = await prisma.task.findMany({
    where: {
      parseId,
      taskType: TASK_TYPES.TIMELINE,
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

    const taskData = {
      userId,
      parseId,
      taskType: TASK_TYPES.TIMELINE,
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
      await prisma.task.update({
        where: { id: existingTask.id },
        data: taskData,
      });
    } else {
      // Create new task
      await prisma.task.create({
        data: taskData,
      });
    }
  }

  // Delete timeline tasks that no longer have corresponding timeline events
  const taskIdsToDelete = existingTasks
    .filter(task => !processedEventIds.has(task.timelineEventId || ''))
    .map(task => task.id);

  if (taskIdsToDelete.length > 0) {
    await prisma.task.deleteMany({
      where: {
        id: { in: taskIdsToDelete },
      },
    });
  }
}

/**
 * Syncs timeline tasks for all parses owned by a user
 */
export async function syncAllTimelineTasks(userId: string): Promise<void> {
  const parses = await prisma.parse.findMany({
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
  await prisma.task.deleteMany({
    where: {
      parseId,
      taskType: TASK_TYPES.TIMELINE,
    },
  });
}
