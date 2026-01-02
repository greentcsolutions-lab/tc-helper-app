// src/lib/date-utils.ts
// Date calculation utilities for transaction timelines

import { format, addDays, isWeekend, parseISO } from 'date-fns';

/**
 * US Federal Holidays (fixed dates)
 * This is a basic list - you may want to expand this
 */
const US_HOLIDAYS_2024_2027 = [
  '2024-01-01', // New Year's Day
  '2024-07-04', // Independence Day
  '2024-12-25', // Christmas
  '2025-01-01',
  '2025-07-04',
  '2025-12-25',
  '2026-01-01',
  '2026-07-04',
  '2026-12-25',
  '2027-01-01',
  '2027-07-04',
  '2027-12-25',
];

/**
 * Check if a date is a US federal holiday
 */
function isHoliday(date: Date): boolean {
  const dateStr = format(date, 'yyyy-MM-dd');
  return US_HOLIDAYS_2024_2027.includes(dateStr);
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
