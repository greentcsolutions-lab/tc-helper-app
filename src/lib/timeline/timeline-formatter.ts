// src/lib/timeline/timeline-formatter.ts
// Version: 2.0.0 - 2026-01-15
// Updated to work with structured timeline data

import { calculateTimelineDate, formatDisplayDate, calculateEffectiveDate } from '@/lib/date-utils';
import type { TimelineEventData, TimelineDataStructured } from '@/types/timeline';

export interface TimelineFieldSource {
  type: 'days' | 'specified' | 'not_set';
  value: number | string | null;
  useBusinessDays?: boolean;
}

export interface FormattedTimelineField {
  calculatedDate: string | null; // YYYY-MM-DD format
  displayDate: string | null; // MM/DD/YYYY format
  source: TimelineFieldSource;
  displayText: string; // e.g., "02/24/2026 (30 days)" or "Not set"
}

/**
 * Formats a timeline field value (days or date) with its calculated date and source
 *
 * @param value - The field value (number of days or date string)
 * @param acceptanceDate - The acceptance date to calculate from
 * @param useBusinessDays - Whether to use business days calculation
 * @returns Formatted timeline field with calculated date and source
 */
export function formatTimelineField(
  value: number | string | null | undefined,
  acceptanceDate: string | null | undefined,
  useBusinessDays: boolean = false
): FormattedTimelineField {
  // Handle "not set" case
  if (!value || value === 'Not set') {
    return {
      calculatedDate: null,
      displayDate: null,
      source: { type: 'not_set', value: null },
      displayText: 'Not set',
    };
  }

  // Handle number of days
  if (typeof value === 'number') {
    if (!acceptanceDate) {
      return {
        calculatedDate: null,
        displayDate: null,
        source: { type: 'days', value, useBusinessDays },
        displayText: `${value} ${useBusinessDays ? 'business days' : 'days'}`,
      };
    }

    const calculatedDate = calculateTimelineDate(acceptanceDate, value, useBusinessDays);
    const displayDate = formatDisplayDate(calculatedDate);

    return {
      calculatedDate,
      displayDate,
      source: { type: 'days', value, useBusinessDays },
      displayText: `${displayDate} (${value} ${useBusinessDays ? 'business days' : 'days'})`,
    };
  }

  // Handle date string (YYYY-MM-DD format)
  if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const displayDate = formatDisplayDate(value);

    return {
      calculatedDate: value,
      displayDate,
      source: { type: 'specified', value },
      displayText: `${displayDate} (specified)`,
    };
  }

  // Handle unknown format - shouldn't happen but graceful fallback
  return {
    calculatedDate: null,
    displayDate: null,
    source: { type: 'not_set', value: String(value) },
    displayText: String(value),
  };
}

/**
 * Timeline field configuration
 */
export interface TimelineFieldConfig {
  key: keyof TimelineData;
  label: string;
  useBusinessDays: boolean;
}

interface TimelineData {
  acceptanceDate?: string;
  closingDays?: number | string;
  initialDepositDays?: number | string;
  sellerDeliveryDays?: number | string;
  inspectionDays?: number | string;
  appraisalDays?: number | string;
  loanDays?: number | string;
}

/**
 * Timeline field definitions
 */
export const TIMELINE_FIELDS: TimelineFieldConfig[] = [
  { key: 'closingDays', label: 'Closing Date', useBusinessDays: false },
  { key: 'initialDepositDays', label: 'Initial Deposit', useBusinessDays: true },
  { key: 'sellerDeliveryDays', label: 'Seller Delivery', useBusinessDays: false },
  { key: 'inspectionDays', label: 'Inspection Contingency', useBusinessDays: false },
  { key: 'appraisalDays', label: 'Appraisal Contingency', useBusinessDays: false },
  { key: 'loanDays', label: 'Loan Contingency', useBusinessDays: false },
];

/**
 * Format all timeline fields for display
 */
export function formatAllTimelineFields(
  timeline: TimelineData | null | undefined
): Record<string, FormattedTimelineField> {
  if (!timeline) {
    return {};
  }

  const result: Record<string, FormattedTimelineField> = {};

  for (const field of TIMELINE_FIELDS) {
    result[field.key] = formatTimelineField(
      timeline[field.key],
      timeline.acceptanceDate,
      field.useBusinessDays
    );
  }

  return result;
}

/**
 * Format a timeline event from structured data
 * @param eventData - The structured timeline event data
 * @param effectiveDate - The calculated effective date (YYYY-MM-DD)
 * @returns Display text like "01/24/2026 (3 business days after acceptance)"
 */
export function formatStructuredTimelineEvent(
  eventData: TimelineEventData,
  effectiveDate: string | null
): string {
  if (!effectiveDate) {
    return 'Not set';
  }

  // Format the date as MM/DD/YYYY
  const displayDate = formatDisplayDate(effectiveDate);

  // Build the source description
  let sourceDescription = '';

  if (eventData.dateType === 'specified') {
    sourceDescription = 'specified';
  } else if (eventData.dateType === 'relative' && eventData.relativeDays !== undefined) {
    const dayTypeText = eventData.dayType === 'business' ? 'business days' : 'days';
    const directionText = eventData.direction === 'before' ? 'before' : 'after';
    const anchorText = eventData.anchorPoint || 'acceptance';

    sourceDescription = `${eventData.relativeDays} ${dayTypeText} ${directionText} ${anchorText}`;
  }

  return `${displayDate} (${sourceDescription})`;
}

/**
 * Format all structured timeline events with their calculated dates
 * @param timelineData - The structured timeline data
 * @param effectiveDates - Map of event keys to calculated dates
 * @returns Map of event keys to formatted display text
 */
export function formatAllStructuredTimelineEvents(
  timelineData: TimelineDataStructured | null | undefined,
  effectiveDates: Record<string, string>
): Record<string, string> {
  if (!timelineData) {
    return {};
  }

  const result: Record<string, string> = {};

  for (const [eventKey, eventData] of Object.entries(timelineData)) {
    const effectiveDate = effectiveDates[eventKey] || null;
    result[eventKey] = formatStructuredTimelineEvent(eventData, effectiveDate);
  }

  return result;
}
