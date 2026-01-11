// src/lib/tasks/ai-tasks-template.ts
// Manages the default AI Tasks template for users

import { db } from '@/lib/prisma';

/**
 * Default AI Tasks that are auto-generated based on contract terms
 * These mirror the tasks currently auto-generated in sync-timeline-tasks.ts
 */
export const DEFAULT_AI_TASKS = [
  {
    title: 'Escrow Opened',
    description: 'Escrow should be opened within 1 business day of acceptance',
    taskTypes: ['escrow', 'ai'],
    dueDateType: 'days_after_acceptance' as const,
    dueDateValue: 1,
  },
  {
    title: 'Deposit Due',
    description: 'Initial earnest money deposit due',
    taskTypes: ['timeline', 'ai'],
    dueDateType: 'specific' as const,
    dueDateValue: 0, // Will be calculated from initialDepositDueDate
  },
  {
    title: 'Seller Disclosures Due',
    description: 'Seller delivery of disclosures',
    taskTypes: ['timeline', 'ai'],
    dueDateType: 'specific' as const,
    dueDateValue: 0, // Will be calculated from sellerDeliveryOfDisclosuresDate
  },
  {
    title: 'Investigation Contingency Removal',
    description: 'Investigation contingency removal deadline',
    taskTypes: ['timeline', 'ai'],
    dueDateType: 'days_after_acceptance' as const,
    dueDateValue: 17, // Common default
  },
  {
    title: 'Appraisal Contingency Removal',
    description: 'Appraisal contingency removal deadline',
    taskTypes: ['timeline', 'lender', 'ai'],
    dueDateType: 'days_after_acceptance' as const,
    dueDateValue: 17, // Common default
  },
  {
    title: 'Loan Contingency Removal',
    description: 'Loan contingency removal deadline',
    taskTypes: ['timeline', 'lender', 'ai'],
    dueDateType: 'days_after_acceptance' as const,
    dueDateValue: 21, // Common default
  },
  {
    title: 'Broker file approved',
    description: 'Broker file should be approved at least 7 days before closing',
    taskTypes: ['broker', 'ai'],
    dueDateType: 'days_from_close' as const,
    dueDateValue: -7,
  },
  {
    title: 'Close of Escrow',
    description: 'Closing date - transfer of ownership',
    taskTypes: ['timeline', 'escrow', 'ai'],
    dueDateType: 'days_after_acceptance' as const,
    dueDateValue: 30, // Common default
  },
];

/**
 * Creates or updates the AI Tasks template for a user
 * This is the default system template that doesn't count toward user's template limit
 */
export async function ensureAITasksTemplate(userId: string): Promise<string> {
  // Check if user already has an AI Tasks template
  const existingTemplate = await db.userTaskTemplate.findFirst({
    where: {
      userId,
      isSystemTemplate: true,
    },
  });

  if (existingTemplate) {
    // Update existing template with latest tasks
    await db.userTaskTemplate.update({
      where: { id: existingTemplate.id },
      data: {
        name: 'AI Tasks',
        description: 'Auto-generated tasks based on contract terms',
        fileType: 'escrow',
        isDefaultForNewFiles: true,
        isSystemTemplate: true,
        tasks: DEFAULT_AI_TASKS,
      },
    });
    return existingTemplate.id;
  }

  // Create new AI Tasks template
  const template = await db.userTaskTemplate.create({
    data: {
      userId,
      name: 'AI Tasks',
      description: 'Auto-generated tasks based on contract terms',
      fileType: 'escrow',
      isDefaultForNewFiles: true,
      isSystemTemplate: true,
      tasks: DEFAULT_AI_TASKS,
    },
  });

  return template.id;
}

/**
 * Gets the AI Tasks template for a user
 * Creates it if it doesn't exist
 */
export async function getAITasksTemplate(userId: string) {
  const template = await db.userTaskTemplate.findFirst({
    where: {
      userId,
      isSystemTemplate: true,
    },
  });

  if (!template) {
    const templateId = await ensureAITasksTemplate(userId);
    return await db.userTaskTemplate.findUnique({
      where: { id: templateId },
    });
  }

  return template;
}

/**
 * Checks if AI tasks are enabled for a user
 */
export async function areAITasksEnabled(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { aiTasksEnabled: true },
  });

  return user?.aiTasksEnabled ?? true; // Default to true
}

/**
 * Toggles AI tasks on/off for a user
 */
export async function setAITasksEnabled(userId: string, enabled: boolean): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: { aiTasksEnabled: enabled },
  });
}
