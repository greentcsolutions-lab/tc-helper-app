// src/lib/dates/extract-timeline-events.ts
// Version: 2.0.0 - 2026-01-15
// BREAKING: Reworked to use structured timeline data with dynamic anchor points

import { parseISO, isValid, isFuture, addDays } from "date-fns";
import { calculateAllEffectiveDates } from '@/lib/date-utils';
import { formatTimelineEventDisplay, STANDARD_TIMELINE_EVENTS } from '@/types/timeline';

export interface TimelineEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  type: 'acceptance' | 'deadline' | 'contingency' | 'closing' | 'deposit';
  parseId: string;
  propertyAddress?: string;
  status: 'upcoming' | 'overdue' | 'completed';

  // NEW: Source information for display
  displayText?: string; // e.g., "01/24/2026 (3 business days after acceptance)"
  sourceType?: 'specified' | 'relative'; // How the date was determined
}

/**
 * Parses a date string in MM/DD/YYYY format, ISO format, or relative days format
 */
function parseDate(dateStr: string | number | undefined, acceptanceDate?: Date): Date | null {
  if (!dateStr) return null;

  // If it's a number of days, calculate from acceptance date
  if (typeof dateStr === 'number') {
    if (!acceptanceDate) return null;
    return addDays(acceptanceDate, dateStr);
  }

  // Try MM/DD/YYYY format (common in California contracts)
  const mmddyyyyRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  const match = dateStr.match(mmddyyyyRegex);

  if (match) {
    const [, month, day, year] = match;
    const date = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
    return isValid(date) ? date : null;
  }

  // Try ISO format
  try {
    const date = parseISO(dateStr);
    if (isValid(date)) return date;
  } catch {
    // Continue to next attempt
  }

  // Try to extract number of days from string like "3 days" or "3"
  if (acceptanceDate) {
    const daysMatch = dateStr.match(/^(\d+)\s*(?:days?)?$/i);
    if (daysMatch) {
      const days = parseInt(daysMatch[1], 10);
      if (!isNaN(days)) {
        return addDays(acceptanceDate, days);
      }
    }
  }

  return null;
}

/**
 * Calculate contingency removal date based on acceptance date + days
 */
function calculateContingencyDate(acceptanceDate: Date, days: number): Date {
  return addDays(acceptanceDate, days);
}

/**
 * Determines if event is upcoming, overdue, or completed
 */
function getEventStatus(date: Date): TimelineEvent['status'] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const eventDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (eventDate < today) return 'overdue';
  if (eventDate.getTime() === today.getTime() || isFuture(eventDate)) return 'upcoming';
  return 'completed';
}

/**
 * Extract all timeline events from a parsed contract
 * Uses structured timeline data with dynamic anchor points
 */
export function extractTimelineEvents(parse: any): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const parseId = parse.id;
  const propertyAddress = parse.propertyAddress || 'Unknown Property';

  // Use new structured timeline data if available
  if (parse.timelineDataStructured && typeof parse.timelineDataStructured === 'object') {
    const timelineData = parse.timelineDataStructured;

    // Big 3 contingencies that always show (even if waived)
    const ALWAYS_SHOW_EVENTS = ['inspectionContingency', 'appraisalContingency', 'loanContingency'];

    // Calculate all effective dates (handles dependencies)
    const effectiveDates = calculateAllEffectiveDates(timelineData);

    // Create timeline events from calculated dates
    for (const [eventKey, eventData] of Object.entries(timelineData)) {
      // Skip waived events (unless they're in the always-show list)
      if (eventData.waived && !ALWAYS_SHOW_EVENTS.includes(eventKey)) {
        console.log(`[extractTimelineEvents] Skipping waived event: ${eventKey}`);
        continue;
      }

      const effectiveDate = effectiveDates[eventKey];

      if (!effectiveDate) {
        console.warn(`[extractTimelineEvents] No effective date calculated for: ${eventKey}`);
        continue;
      }

      const dateObj = parseISO(effectiveDate);
      if (!isValid(dateObj)) {
        console.warn(`[extractTimelineEvents] Invalid date for ${eventKey}: ${effectiveDate}`);
        continue;
      }

      // Determine event type and title
      let eventType: TimelineEvent['type'] = 'deadline';
      let title = eventData.displayName || eventKey;

      if (eventKey === STANDARD_TIMELINE_EVENTS.ACCEPTANCE || eventKey === 'acceptance') {
        eventType = 'acceptance';
        title = 'Acceptance';
      } else if (eventKey === STANDARD_TIMELINE_EVENTS.INITIAL_DEPOSIT || eventKey === 'initialDeposit') {
        eventType = 'deposit';
        title = 'Deposit Due';
      } else if (eventKey === STANDARD_TIMELINE_EVENTS.CLOSING || eventKey === 'closing') {
        eventType = 'closing';
        title = 'CLOSING';
      } else if (
        eventKey.toLowerCase().includes('contingency') ||
        eventKey === STANDARD_TIMELINE_EVENTS.INSPECTION_CONTINGENCY ||
        eventKey === STANDARD_TIMELINE_EVENTS.APPRAISAL_CONTINGENCY ||
        eventKey === STANDARD_TIMELINE_EVENTS.LOAN_CONTINGENCY
      ) {
        eventType = 'contingency';
      }

      // Generate display text with source
      const displayText = formatTimelineEventDisplay({
        dateType: eventData.dateType,
        effectiveDate,
        relativeDays: eventData.relativeDays,
        anchorPoint: eventData.anchorPoint,
        direction: eventData.direction,
        dayType: eventData.dayType,
        specifiedDate: eventData.specifiedDate,
      });

      // Determine status
      let status: TimelineEvent['status'] = getEventStatus(dateObj);

      // Acceptance is always completed
      if (eventType === 'acceptance') {
        status = 'completed';
      }

      events.push({
        id: `${parseId}-${eventKey}`,
        title,
        start: dateObj,
        end: dateObj,
        allDay: true,
        type: eventType,
        parseId,
        propertyAddress,
        status,
        displayText,
        sourceType: eventData.dateType,
      });
    }

    return events;
  }

  // FALLBACK: Legacy extraction for parses without structured timeline data
  // This maintains backwards compatibility with existing parse records
  console.log(`[extractTimelineEvents] Using legacy extraction for parse ${parseId}`);

  // 1. Effective Date (Acceptance Date)
  const acceptanceDate = parseDate(parse.effectiveDate);
  if (acceptanceDate) {
    events.push({
      id: `${parseId}-acceptance`,
      title: 'Acceptance',
      start: acceptanceDate,
      end: acceptanceDate,
      allDay: true,
      type: 'acceptance',
      parseId,
      propertyAddress,
      status: 'completed',
      sourceType: 'specified',
    });
  }

  // 2. Initial Deposit Due
  const depositDue = parseDate(parse.initialDepositDueDate, acceptanceDate || undefined);
  if (depositDue) {
    events.push({
      id: `${parseId}-deposit`,
      title: 'Deposit Due',
      start: depositDue,
      end: depositDue,
      allDay: true,
      type: 'deposit',
      parseId,
      propertyAddress,
      status: getEventStatus(depositDue),
    });
  }

  // 3. Seller Delivery of Disclosures
  const sellerDisclosuresDate = parseDate(parse.sellerDeliveryOfDisclosuresDate, acceptanceDate || undefined);
  if (sellerDisclosuresDate) {
    events.push({
      id: `${parseId}-seller-disclosures`,
      title: 'Seller Disclosures Due',
      start: sellerDisclosuresDate,
      end: sellerDisclosuresDate,
      allDay: true,
      type: 'deadline',
      parseId,
      propertyAddress,
      status: getEventStatus(sellerDisclosuresDate),
    });
  }

  // 4. Contingency Removal Dates
  if (acceptanceDate && parse.contingencies) {
    const contingencies = parse.contingencies;

    if (contingencies.loanDays && typeof contingencies.loanDays === 'number') {
      const loanDate = calculateContingencyDate(acceptanceDate, contingencies.loanDays);
      events.push({
        id: `${parseId}-loan-contingency`,
        title: 'Loan Contingency Removal',
        start: loanDate,
        end: loanDate,
        allDay: true,
        type: 'contingency',
        parseId,
        propertyAddress,
        status: getEventStatus(loanDate),
      });
    }

    if (contingencies.appraisalDays && typeof contingencies.appraisalDays === 'number') {
      const appraisalDate = calculateContingencyDate(acceptanceDate, contingencies.appraisalDays);
      events.push({
        id: `${parseId}-appraisal-contingency`,
        title: 'Appraisal Contingency Removal',
        start: appraisalDate,
        end: appraisalDate,
        allDay: true,
        type: 'contingency',
        parseId,
        propertyAddress,
        status: getEventStatus(appraisalDate),
      });
    }

    if (contingencies.inspectionDays && typeof contingencies.inspectionDays === 'number') {
      const investigationDate = calculateContingencyDate(acceptanceDate, contingencies.inspectionDays);
      events.push({
        id: `${parseId}-investigation-contingency`,
        title: 'Investigation Contingency Removal',
        start: investigationDate,
        end: investigationDate,
        allDay: true,
        type: 'contingency',
        parseId,
        propertyAddress,
        status: getEventStatus(investigationDate),
      });
    }
  }

  // 5. Close of Escrow
  let closeDate: Date | null = null;
  if (typeof parse.closingDate === 'number' && acceptanceDate) {
    closeDate = calculateContingencyDate(acceptanceDate, parse.closingDate);
  } else if (typeof parse.closingDate === 'string') {
    closeDate = parseDate(parse.closingDate, acceptanceDate || undefined);
  }

  if (closeDate) {
    events.push({
      id: `${parseId}-closing`,
      title: 'CLOSING',
      start: closeDate,
      end: closeDate,
      allDay: true,
      type: 'closing',
      parseId,
      propertyAddress,
      status: getEventStatus(closeDate),
    });
  }

  return events;
}

/**
 * Get all events from multiple parses, sorted by date
 */
export function getAllTimelineEvents(parses: any[]): TimelineEvent[] {
  const allEvents = parses.flatMap(parse => extractTimelineEvents(parse));
  return allEvents.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/**
 * Get next upcoming events (not overdue, sorted by date)
 */
export function getUpcomingEvents(parses: any[], limit: number = 5): TimelineEvent[] {
  const allEvents = getAllTimelineEvents(parses);
  const upcoming = allEvents.filter(event => event.status === 'upcoming');
  return upcoming.slice(0, limit);
}

/**
 * Get all events on the next upcoming event date
 * Returns all events that occur on the same date as the earliest upcoming event
 */
export function getNextEventsByDate(parses: any[]): TimelineEvent[] {
  const allEvents = getAllTimelineEvents(parses);
  const upcoming = allEvents.filter(event => event.status === 'upcoming');

  if (upcoming.length === 0) return [];

  // Get the earliest upcoming date
  const nextEventDate = upcoming[0].start;

  // Return all events that occur on that date
  return upcoming.filter(
    event => event.start.getTime() === nextEventDate.getTime()
  );
}
