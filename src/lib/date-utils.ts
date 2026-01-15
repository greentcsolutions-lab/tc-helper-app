// src/lib/date-utils.ts
// Version: 2.0.0 - 2026-01-15
// Updated to use @18f/us-federal-holidays package for accurate federal holiday detection

import { format, addDays, isWeekend, parseISO } from 'date-fns';
import { isAHoliday } from '@18f/us-federal-holidays';

/**
 * Check if a date is a US federal holiday using the official federal holidays package
 */
function isHoliday(date: Date): boolean {
  return isAHoliday(date);
}

/**
 * Check if a date is a business day (not weekend, not holiday)
 */
function isBusinessDay(date: Date): boolean {
  return !isWeekend(date) && !isHoliday(date);
}

/**
 * Add business days to a date
 * @param startDate - The starting date (acceptance date = day 0)
 * @param businessDays - Number of business days to add
 * @returns The calculated date
 */
export function addBusinessDays(startDate: Date, businessDays: number): Date {
  let currentDate = new Date(startDate);
  let daysAdded = 0;

  while (daysAdded < businessDays) {
    currentDate = addDays(currentDate, 1);
    if (isBusinessDay(currentDate)) {
      daysAdded++;
    }
  }

  return currentDate;
}

/**
 * Add calendar days to a date, adjusting if it falls on weekend/holiday
 * @param startDate - The starting date (acceptance date = day 0)
 * @param calendarDays - Number of calendar days to add
 * @returns The calculated date (adjusted if it falls on weekend/holiday)
 */
export function addCalendarDaysWithAdjustment(
  startDate: Date,
  calendarDays: number
): Date {
  let targetDate = addDays(startDate, calendarDays);

  // If the target date falls on a weekend or holiday, move to next business day
  while (!isBusinessDay(targetDate)) {
    targetDate = addDays(targetDate, 1);
  }

  return targetDate;
}

/**
 * Calculate timeline date from acceptance date
 * @param acceptanceDate - The acceptance date (string YYYY-MM-DD)
 * @param days - Number of days to add
 * @param useBusinessDays - If true, uses business days; otherwise calendar days with adjustment
 * @returns Formatted date string (YYYY-MM-DD)
 */
export function calculateTimelineDate(
  acceptanceDate: string,
  days: number,
  useBusinessDays = false
): string {
  const startDate = parseISO(acceptanceDate);

  const targetDate = useBusinessDays
    ? addBusinessDays(startDate, days)
    : addCalendarDaysWithAdjustment(startDate, days);

  return format(targetDate, 'yyyy-MM-dd');
}

/**
 * Format date for display (MM/DD/YYYY)
 */
export function formatDisplayDate(date: string | Date): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return format(dateObj, 'MM/dd/yyyy');
}

/**
 * Parse user input date (MM/DD/YYYY) to ISO format (YYYY-MM-DD)
 */
export function parseUserDate(input: string): string | null {
  // Try to parse MM/DD/YYYY format
  const match = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;

  const [, month, day, year] = match;
  const date = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);

  if (isNaN(date.getTime())) return null;

  return format(date, 'yyyy-MM-dd');
}

/**
 * Validate that a date string is in YYYY-MM-DD format
 */
export function isValidISODate(dateStr: string): boolean {
  const match = dateStr.match(/^\d{4}-\d{2}-\d{2}$/);
  if (!match) return false;

  const date = parseISO(dateStr);
  return !isNaN(date.getTime());
}

/**
 * Calculate effective date from structured timeline data
 * @param timelineEvent - The timeline event data with calculation details
 * @param anchorDates - Map of anchor point names to their effective dates (YYYY-MM-DD)
 * @returns Calculated effective date (YYYY-MM-DD) or null if cannot be calculated
 */
export function calculateEffectiveDate(
  timelineEvent: {
    dateType: 'specified' | 'relative';
    specifiedDate?: string;
    relativeDays?: number;
    anchorPoint?: string;
    direction?: 'after' | 'before';
    dayType?: 'calendar' | 'business';
  },
  anchorDates: Record<string, string>
): string | null {
  // If specified, return the specified date
  if (timelineEvent.dateType === 'specified') {
    return timelineEvent.specifiedDate || null;
  }

  // If relative, calculate from anchor point
  if (timelineEvent.dateType === 'relative') {
    const anchorPoint = timelineEvent.anchorPoint || 'acceptance';
    const anchorDate = anchorDates[anchorPoint];

    if (!anchorDate) {
      console.warn(`[calculateEffectiveDate] Anchor date not found for: ${anchorPoint}`);
      return null;
    }

    if (
      timelineEvent.relativeDays === undefined ||
      timelineEvent.relativeDays === null
    ) {
      console.warn(`[calculateEffectiveDate] relativeDays not set`);
      return null;
    }

    const direction = timelineEvent.direction || 'after';
    const dayType = timelineEvent.dayType || 'calendar';
    const daysToAdd = direction === 'after' ? timelineEvent.relativeDays : -timelineEvent.relativeDays;

    const startDate = parseISO(anchorDate);

    if (isNaN(startDate.getTime())) {
      console.warn(`[calculateEffectiveDate] Invalid anchor date: ${anchorDate}`);
      return null;
    }

    let targetDate: Date;

    if (dayType === 'business') {
      // Add business days
      targetDate = addBusinessDays(startDate, Math.abs(daysToAdd));
      if (direction === 'before') {
        // For "before", we need to subtract business days
        targetDate = subtractBusinessDays(startDate, Math.abs(daysToAdd));
      }
    } else {
      // Add calendar days with adjustment
      targetDate = addCalendarDaysWithAdjustment(startDate, daysToAdd);
    }

    return format(targetDate, 'yyyy-MM-dd');
  }

  return null;
}

/**
 * Subtract business days from a date
 * @param startDate - The starting date
 * @param businessDays - Number of business days to subtract
 * @returns The calculated date
 */
function subtractBusinessDays(startDate: Date, businessDays: number): Date {
  let currentDate = new Date(startDate);
  let daysSubtracted = 0;

  while (daysSubtracted < businessDays) {
    currentDate = addDays(currentDate, -1);
    if (isBusinessDay(currentDate)) {
      daysSubtracted++;
    }
  }

  return currentDate;
}

/**
 * Calculate all effective dates for a set of timeline events
 * This handles dependencies between events (e.g., buyer review depends on seller disclosures)
 * @param timelineData - The structured timeline data from database
 * @returns Map of event keys to their calculated effective dates
 */
export function calculateAllEffectiveDates(
  timelineData: Record<string, any>
): Record<string, string> {
  const effectiveDates: Record<string, string> = {};
  const processed = new Set<string>();
  const processing = new Set<string>();

  // Recursive function to calculate date with dependency resolution
  const calculateDate = (eventKey: string): string | null => {
    // Already processed
    if (processed.has(eventKey)) {
      return effectiveDates[eventKey] || null;
    }

    // Circular dependency detection
    if (processing.has(eventKey)) {
      console.error(`[calculateAllEffectiveDates] Circular dependency detected for: ${eventKey}`);
      return null;
    }

    const event = timelineData[eventKey];
    if (!event) {
      return null;
    }

    processing.add(eventKey);

    // If specified date, no calculation needed
    if (event.dateType === 'specified' && event.specifiedDate) {
      effectiveDates[eventKey] = event.specifiedDate;
      processed.add(eventKey);
      processing.delete(eventKey);
      return event.specifiedDate;
    }

    // If relative, ensure anchor date is calculated first
    if (event.dateType === 'relative' && event.anchorPoint) {
      const anchorDate = calculateDate(event.anchorPoint);

      if (!anchorDate) {
        console.warn(`[calculateAllEffectiveDates] Could not calculate anchor date for: ${event.anchorPoint}`);
        processing.delete(eventKey);
        return null;
      }

      // Now calculate this event's date
      const effectiveDate = calculateEffectiveDate(event, effectiveDates);
      if (effectiveDate) {
        effectiveDates[eventKey] = effectiveDate;
        processed.add(eventKey);
      }

      processing.delete(eventKey);
      return effectiveDate;
    }

    processing.delete(eventKey);
    return null;
  };

  // Calculate dates for all events
  for (const eventKey of Object.keys(timelineData)) {
    if (!processed.has(eventKey)) {
      calculateDate(eventKey);
    }
  }

  return effectiveDates;
}
