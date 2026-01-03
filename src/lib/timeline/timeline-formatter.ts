// src/lib/timeline/timeline-formatter.ts
// Utility for formatting timeline dates with their sources

import { calculateTimelineDate, formatDisplayDate } from '@/lib/date-utils';

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
