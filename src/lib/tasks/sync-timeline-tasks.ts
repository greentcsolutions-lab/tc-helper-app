// src/lib/tasks/sync-timeline-tasks.ts
// Syncs timeline events to Task records

import { db } from '@/lib/prisma';
import { extractTimelineEvents, TimelineEvent } from '@/lib/dates/extract-timeline-events';
import { TASK_TYPES, TASK_STATUS, mapTimelineStatusToTaskStatus } from '@/types/task';
import { formatDateForProperty, parseDateInTimezone, getTimezoneForAddress } from '@/lib/dates/timezone-utils';

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

  // Create tasks for ALL timeline events (not just defaults)
  await syncAllTimelineEvents(parseId, userId, parse);
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
async function syncAllTimelineEvents(parseId: string, userId: string, parse: any): Promise<void> {
  // Extract dates from structured timeline data
  const timelineData = parse.timelineDataStructured || {};

  console.log(`[syncAllTimelineEvents] Processing ${Object.keys(timelineData).length} timeline events for parse ${parseId}`);

  // Get the timezone for this property
  const timezone = getTimezoneForAddress(parse.propertyAddress);
  console.log(`[syncAllTimelineEvents] Using timezone ${timezone} for property ${parse.propertyAddress}`);

  // Iterate through all timeline events and create tasks
  for (const [eventKey, eventData] of Object.entries(timelineData)) {
    const event = eventData as any;

    // Skip if no effective date
    if (!event?.effectiveDate) {
      console.log(`[syncAllTimelineEvents] Skipping ${eventKey} - no effective date`);
      continue;
    }

    // Skip if waived
    if (event.waived === true) {
      console.log(`[syncAllTimelineEvents] Skipping ${eventKey} - waived`);
      continue;
    }

    // Parse the date in the property's timezone
    // We parse at noon to avoid DST and timezone edge cases
    const dueDate = parseDateInTimezone(event.effectiveDate, timezone);
    if (isNaN(dueDate.getTime())) {
      console.log(`[syncAllTimelineEvents] Skipping ${eventKey} - invalid date: ${event.effectiveDate}`);
      continue;
    }

    // Determine the display name
    const displayName = event.displayName || eventKey;

    // Determine task types based on event key
    const taskTypes = determineTaskTypes(eventKey);

    console.log(`[syncAllTimelineEvents] Creating/updating task for ${eventKey}: "${displayName}" due ${dueDate.toISOString()}`);

    // Create or update the task
    await upsertTimelineTask(parseId, userId, parse, {
      timelineEventId: `${parseId}-${eventKey}`,
      title: displayName,
      description: event.description || null,
      taskTypes,
      dueDate,
      eventKey, // Pass separately for lookup logic
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
    timelineEventId: string;
    title: string;
    description: string | null;
    taskTypes: string[];
    dueDate: Date;
    eventKey: string; // For logging only
  }
): Promise<void> {
  // Find existing task by parseId + timelineEventId
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
    dueDate: taskInfo.dueDate,
    dueDateType: 'specific' as const,
    dueDateValue: null,
    status: existingTask?.status || TASK_STATUS.NOT_STARTED,
    columnId: existingTask?.columnId || TASK_STATUS.NOT_STARTED,
    sortOrder: existingTask?.sortOrder || 0,
    isCustom: false,
    isAiGenerated: existingTask?.isAiGenerated ?? true, // Preserve existing value, default to true for new tasks
    completedAt: existingTask?.completedAt || null,
  };

  if (existingTask) {
    console.log(`[upsertTimelineTask] Updating existing task ${existingTask.id} for ${taskInfo.eventKey}`);
    await db.task.update({
      where: { id: existingTask.id },
      data: taskData,
    });
  } else {
    console.log(`[upsertTimelineTask] Creating new task for ${taskInfo.eventKey}`);
    await db.task.create({
      data: taskData,
    });
  }
}

/**
 * OLD FUNCTION - Syncs the 7 default tasks, reading dates from timeline data
 * These tasks have a read/write relationship with the timeline
 * DEPRECATED: Use syncAllTimelineEvents instead
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

  // Get key dates from timeline
  const acceptanceDate = getTimelineDate('acceptance') || (parse.effectiveDate ? new Date(parse.effectiveDate) : null);
  const closingDate = getTimelineDate('closing') || (parse.closingDate ? new Date(parse.closingDate) : null);
  const initialDepositDate = getTimelineDate('initialDeposit');
  const inspectionDate = getTimelineDate('inspectionContingency');
  const appraisalDate = getTimelineDate('appraisalContingency');
  const loanDate = getTimelineDate('loanContingency');

  // Task 1: Escrow Opened - 1 business day after acceptance
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

  // Task 2: Initial Deposit - reads from timeline (if not waived)
  if (initialDepositDate && !isWaived('initialDeposit')) {
    const initialDepositEventId = `${parseId}-initialDeposit`;

    await upsertDefaultTask(parseId, userId, parse, {
      timelineEventId: initialDepositEventId,
      title: 'Initial Deposit Due',
      description: 'Submit initial earnest money deposit',
      taskTypes: [TASK_TYPES.ESCROW],
      dueDate: initialDepositDate,
      amount: parse.earnestMoneyDeposit?.amount || null,
    });
  }

  // Task 3: Inspection Contingency - reads from timeline (if not waived)
  if (inspectionDate && !isWaived('inspectionContingency')) {
    const inspectionEventId = `${parseId}-inspectionContingency`;

    await upsertDefaultTask(parseId, userId, parse, {
      timelineEventId: inspectionEventId,
      title: 'Inspection Contingency',
      description: 'Complete inspections and remove inspection contingency',
      taskTypes: [TASK_TYPES.TIMELINE],
      dueDate: inspectionDate,
    });
  }

  // Task 4: Appraisal Contingency - reads from timeline (if not waived)
  if (appraisalDate && !isWaived('appraisalContingency')) {
    const appraisalEventId = `${parseId}-appraisalContingency`;

    await upsertDefaultTask(parseId, userId, parse, {
      timelineEventId: appraisalEventId,
      title: 'Appraisal Contingency',
      description: 'Complete appraisal and remove appraisal contingency',
      taskTypes: [TASK_TYPES.TIMELINE, TASK_TYPES.LENDER],
      dueDate: appraisalDate,
    });
  }

  // Task 5: Loan Contingency - reads from timeline (if not waived)
  if (loanDate && !isWaived('loanContingency')) {
    const loanEventId = `${parseId}-loanContingency`;

    await upsertDefaultTask(parseId, userId, parse, {
      timelineEventId: loanEventId,
      title: 'Loan Contingency',
      description: 'Secure loan approval and remove loan contingency',
      taskTypes: [TASK_TYPES.TIMELINE, TASK_TYPES.LENDER],
      dueDate: loanDate,
    });
  }

  // Task 6: Close of Escrow - reads from timeline
  if (closingDate) {
    const closingEventId = `${parseId}-closing`;

    await upsertDefaultTask(parseId, userId, parse, {
      timelineEventId: closingEventId,
      title: 'CLOSING',
      description: 'Close of escrow',
      taskTypes: [TASK_TYPES.TIMELINE, TASK_TYPES.ESCROW],
      dueDate: closingDate,
    });
  }

  // Task 7: Broker file approved - 7 days before closing
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
    isAiGenerated: existingTask?.isAiGenerated ?? true, // Preserve existing value, default to true for new tasks
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
 * Updates timeline when a task with TIMELINE category is modified
 * This syncs task changes back to the timeline data with smart calculation preservation
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
      propertyAddress: true,
    },
  });

  if (!task || !task.parseId || !task.timelineEventId) {
    console.log(`[syncTaskToTimeline] Skipping - task missing required fields`);
    return;
  }

  // Only sync back if task has TIMELINE category
  if (!task.taskTypes.includes(TASK_TYPES.TIMELINE)) {
    console.log(`[syncTaskToTimeline] Skipping - task ${taskId} is not a timeline task`);
    return;
  }

  // Map timelineEventId back to timeline event key
  // Format is "{parseId}-{eventKey}"
  const eventKey = task.timelineEventId.replace(`${task.parseId}-`, '');

  // Get the parse with full timeline data
  const parse = await db.parse.findUnique({
    where: { id: task.parseId },
    select: {
      id: true,
      effectiveDate: true,
      closingDate: true,
      timelineDataStructured: true,
      propertyAddress: true,
    },
  });

  if (!parse || !parse.timelineDataStructured) {
    console.log(`[syncTaskToTimeline] Skipping - parse or timeline data not found`);
    return;
  }

  const timelineData = parse.timelineDataStructured as any;

  // Get the timezone for this property
  const timezone = getTimezoneForAddress(parse.propertyAddress);
  console.log(`[syncTaskToTimeline] Using timezone ${timezone} for ${eventKey}`);

  // Check if this event exists in timeline
  if (!timelineData[eventKey]) {
    console.log(`[syncTaskToTimeline] Creating new event ${eventKey} in timeline`);
    // Event doesn't exist - create it as specified
    const formattedDate = formatDateForProperty(task.dueDate, parse.propertyAddress);
    timelineData[eventKey] = {
      dateType: 'specified',
      specifiedDate: formattedDate,
      effectiveDate: formattedDate,
      displayName: eventKey,
    };
  } else {
    // Event exists - preserve calculation method
    const event = timelineData[eventKey];
    const updatedDate = formatDateForProperty(task.dueDate, parse.propertyAddress);

    console.log(`[syncTaskToTimeline] Updating ${eventKey}: ${event.effectiveDate} → ${updatedDate}`);

    if (event.dateType === 'relative') {
      // PRESERVE RELATIVE CALCULATION - auto-calculate new relativeDays
      const anchorPoint = event.anchorPoint || 'acceptance';
      const direction = event.direction || 'after';
      const dayType = event.dayType || 'calendar';

      // Get anchor date (parse in property's timezone)
      let anchorDate: Date | null = null;
      if (anchorPoint === 'acceptance' && parse.effectiveDate) {
        anchorDate = parseDateInTimezone(parse.effectiveDate, timezone);
      } else if (anchorPoint === 'closing' && parse.closingDate) {
        anchorDate = parseDateInTimezone(parse.closingDate, timezone);
      } else if (timelineData[anchorPoint]?.effectiveDate) {
        // Anchor to another timeline event
        anchorDate = parseDateInTimezone(timelineData[anchorPoint].effectiveDate, timezone);
      }

      if (anchorDate && !isNaN(anchorDate.getTime())) {
        // Calculate difference in days
        const newDueDate = task.dueDate;
        const diffMs = newDueDate.getTime() - anchorDate.getTime();
        let diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

        // Make positive for relative days
        if (direction === 'before') {
          diffDays = Math.abs(diffDays);
        }

        // For business days, we'd need more complex calculation
        // For now, use calendar days as approximation
        const newRelativeDays = Math.max(0, diffDays);

        console.log(`[syncTaskToTimeline] Auto-calculated: ${eventKey} is now ${newRelativeDays} days ${direction} ${anchorPoint}`);

        // Update with preserved calculation method
        timelineData[eventKey] = {
          ...event,
          relativeDays: newRelativeDays,
          effectiveDate: updatedDate,
        };
      } else {
        console.log(`[syncTaskToTimeline] Could not find anchor date for ${anchorPoint}, converting to specified`);
        // Couldn't find anchor - convert to specified
        timelineData[eventKey] = {
          ...event,
          dateType: 'specified',
          specifiedDate: updatedDate,
          effectiveDate: updatedDate,
        };
      }
    } else {
      // Already specified - just update the date
      console.log(`[syncTaskToTimeline] Updating specified date for ${eventKey}`);
      timelineData[eventKey] = {
        ...event,
        specifiedDate: updatedDate,
        effectiveDate: updatedDate,
      };
    }
  }

  // Save back to database
  await db.parse.update({
    where: { id: task.parseId },
    data: {
      timelineDataStructured: timelineData,
    },
  });

  console.log(`[syncTaskToTimeline] Successfully synced task ${taskId} (${eventKey}) to Parse model`);
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
