// src/types/task.ts
// Task system types and interfaces

// ============================================================================
// TASK TYPES
// ============================================================================

export const TASK_TYPES = {
  TIMELINE: 'timeline',
  BROKER: 'broker',
  ESCROW: 'escrow',
  LENDER: 'lender',
} as const;

export type TaskType = typeof TASK_TYPES[keyof typeof TASK_TYPES];

// ============================================================================
// STATUS TYPES (SHARED WITH TIMELINE)
// ============================================================================

// Base status types that are stored in database
export const TASK_STATUS = {
  NOT_STARTED: 'not_started',
  PENDING: 'pending',
  COMPLETED: 'completed',
} as const;

export type TaskStatus = typeof TASK_STATUS[keyof typeof TASK_STATUS];

// Computed status that includes overdue (not stored, calculated at runtime)
export type TaskStatusWithOverdue = TaskStatus | 'overdue';

// ============================================================================
// DUE DATE TYPES
// ============================================================================

export const DUE_DATE_TYPES = {
  SPECIFIC: 'specific',
  DAYS_AFTER_ACCEPTANCE: 'days_after_acceptance',
  DAYS_FROM_CLOSE: 'days_from_close',
} as const;

export type DueDateType = typeof DUE_DATE_TYPES[keyof typeof DUE_DATE_TYPES];

// ============================================================================
// TASK INTERFACE
// ============================================================================

export interface Task {
  id: string;
  userId: string;
  parseId: string | null;

  // Classification
  taskTypes: TaskType[]; // Can have multiple categories
  timelineEventId: string | null;

  // Details
  title: string;
  description: string | null;
  propertyAddress: string | null;
  amount: number | null;

  // Scheduling
  dueDate: Date;
  dueDateType: DueDateType;
  dueDateValue: number | null;

  // Status & Organization
  status: TaskStatus;
  sortOrder: number;
  columnId: string;

  // Metadata
  isCustom: boolean;
  templateId: string | null;

  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;

  // Relations (optional, for when we include them in queries)
  parse?: {
    id: string;
    propertyAddress: string | null;
    effectiveDate: string | null;
    closingDate: string | null;
  };
}

// ============================================================================
// TASK TEMPLATE INTERFACE
// ============================================================================

export const FILE_TYPES = {
  LISTING: 'listing',
  ESCROW: 'escrow',
} as const;

export type FileType = typeof FILE_TYPES[keyof typeof FILE_TYPES];

export interface TemplateTask {
  title: string;
  description?: string;
  dueDateType: 'days_after_acceptance' | 'days_from_close';
  dueDateValue: number;
}

export interface UserTaskTemplate {
  id: string;
  userId: string;

  // Template Details
  name: string;
  description: string | null;
  fileType: FileType; // "listing" or "escrow"

  // Task Collection
  tasks: TemplateTask[];

  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Determines if a task is overdue based on its due date and status
 * A task is overdue if:
 * 1. Due date is in the past (before today)
 * 2. Status is NOT completed
 */
export function isTaskOverdue(task: { dueDate: Date; status: TaskStatus }): boolean {
  if (task.status === TASK_STATUS.COMPLETED) {
    return false;
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDate = new Date(task.dueDate.getFullYear(), task.dueDate.getMonth(), task.dueDate.getDate());

  return dueDate < today;
}

/**
 * Gets the computed status including overdue
 */
export function getTaskStatus(task: { dueDate: Date; status: TaskStatus }): TaskStatusWithOverdue {
  if (isTaskOverdue(task)) {
    return 'overdue';
  }
  return task.status;
}

/**
 * Gets days until due (positive = future, negative = past, 0 = today)
 */
export function getDaysUntilDue(dueDate: Date): number {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());

  const diffTime = dueDateOnly.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * Formats days until due as a human-readable string
 */
export function formatDaysUntilDue(dueDate: Date): string {
  const days = getDaysUntilDue(dueDate);

  if (days === 0) return 'Today';
  if (days === 1) return '1 day';
  if (days === -1) return '1 day ago';
  if (days > 0) return `${days} days`;
  return `${Math.abs(days)} days ago`;
}

/**
 * Maps timeline event type to task type
 */
export function getTaskTypeFromTimelineEventType(
  eventType: 'acceptance' | 'deadline' | 'contingency' | 'closing' | 'deposit'
): TaskType {
  return TASK_TYPES.TIMELINE;
}

/**
 * Maps timeline status to task status
 */
export function mapTimelineStatusToTaskStatus(
  timelineStatus: 'upcoming' | 'overdue' | 'completed'
): TaskStatus {
  switch (timelineStatus) {
    case 'completed':
      return TASK_STATUS.COMPLETED;
    case 'upcoming':
      return TASK_STATUS.NOT_STARTED;
    case 'overdue':
      return TASK_STATUS.NOT_STARTED; // Stored as not_started, computed as overdue
    default:
      return TASK_STATUS.NOT_STARTED;
  }
}
