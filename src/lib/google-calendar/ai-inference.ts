// src/lib/google-calendar/ai-inference.ts
// AI-powered task type inference using Gemini (BASIC plan feature)

import { GoogleGenerativeAI } from '@google/generative-ai';
import { TaskTypeInferenceResult } from '@/types/calendar';
import { TASK_TYPES } from '@/types/task';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Infers task types from a calendar event using Gemini AI
 * BASIC plan feature only
 */
export async function inferTaskTypes(
  title: string,
  description: string,
  propertyAddress: string
): Promise<TaskTypeInferenceResult> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    const prompt = `You are an AI assistant helping to categorize real estate transaction tasks.

Given a calendar event, determine which task categories it belongs to. Categories are:
- timeline: Key dates and deadlines in the transaction (inspections, appraisals, contingencies, closing)
- broker: Tasks for the real estate broker/agent (showings, marketing, client communication)
- escrow: Escrow and title company tasks (opening escrow, document signing, fund transfers)
- lender: Mortgage and financing tasks (loan applications, appraisals, underwriting)

A task can belong to multiple categories.

Event Details:
Title: ${title}
Description: ${description}
Property: ${propertyAddress}

Instructions:
1. Analyze the event to determine which categories apply
2. Return ONLY a JSON object with this exact format (no markdown, no explanation):
{
  "taskTypes": ["category1", "category2"],
  "confidence": 85,
  "reasoning": "Brief explanation"
}

The taskTypes array must only contain values from: timeline, broker, escrow, lender
Confidence should be 0-100
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();

    // Parse JSON response
    let jsonText = text;

    // Remove markdown code blocks if present
    if (text.startsWith('```json')) {
      jsonText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    } else if (text.startsWith('```')) {
      jsonText = text.replace(/```\n?/g, '').trim();
    }

    const parsed = JSON.parse(jsonText);

    // Validate task types
    const validTaskTypes = parsed.taskTypes.filter((type: string) =>
      Object.values(TASK_TYPES).includes(type as any)
    );

    return {
      taskTypes: validTaskTypes.length > 0 ? validTaskTypes : [TASK_TYPES.TIMELINE],
      confidence: parsed.confidence || 50,
      reasoning: parsed.reasoning,
    };
  } catch (error) {
    console.error('Error inferring task types:', error);
    // Default to timeline if AI fails
    return {
      taskTypes: [TASK_TYPES.TIMELINE],
      confidence: 0,
      reasoning: 'AI inference failed, defaulting to timeline',
    };
  }
}

/**
 * Checks for potential scheduling conflicts using AI
 * BASIC plan feature - Future enhancement
 */
export async function detectSchedulingConflicts(
  userId: string,
  newEventTitle: string,
  newEventDate: Date,
  propertyAddress: string
): Promise<{
  hasConflict: boolean;
  conflictingEvents: string[];
  suggestion?: string;
}> {
  // TODO: Implement conflict detection
  // This would check for:
  // - Multiple inspections at same time for different properties
  // - Team member double-booking (future feature)
  // - Critical timeline conflicts (e.g., closing before loan approval)

  return {
    hasConflict: false,
    conflictingEvents: [],
  };
}

/**
 * Suggests optimal task scheduling using AI
 * BASIC plan feature - Future enhancement
 */
export async function suggestTaskScheduling(
  taskTitle: string,
  taskType: string,
  propertyAddress: string,
  closingDate?: Date
): Promise<{
  suggestedDate: Date | null;
  reasoning: string;
}> {
  // TODO: Implement AI-powered scheduling suggestions
  // This would analyze:
  // - Typical timeline for this type of task
  // - Dependencies on other tasks
  // - Best practices for transaction flow

  return {
    suggestedDate: null,
    reasoning: 'Not implemented yet',
  };
}
