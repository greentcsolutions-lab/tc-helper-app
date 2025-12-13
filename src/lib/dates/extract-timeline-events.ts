// src/lib/dates/extract-timeline-events.ts
// Extracts all important dates from parsed contract data

import { addDays, parseISO, isValid, isFuture, isPast } from "date-fns";

export interface TimelineEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  type: 'deadline' | 'contingency' | 'closing' | 'deposit';
  parseId: string;
  propertyAddress?: string;
  status: 'upcoming' | 'overdue' | 'completed';
}

/**
 * Parses a date string in MM/DD/YYYY format or ISO format
 */
function parseDate(dateStr: string | number | undefined): Date | null {
  if (!dateStr) return null;

  // If it's a number of days, return null (needs anchor date)
  if (typeof dateStr === 'number') return null;

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
    return isValid(date) ? date : null;
  } catch {
    return null;
  }
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
 */
export function extractTimelineEvents(parse: any): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const data = parse.formatted || {};
  const parseId = parse.id;
  const propertyAddress = data.property_address?.full || 'Unknown Property';

  // 1. Final Acceptance Date
  const acceptanceDate = parseDate(data.final_acceptance_date);
  if (acceptanceDate) {
    events.push({
      id: `${parseId}-acceptance`,
      title: `Acceptance: ${propertyAddress}`,
      start: acceptanceDate,
      end: acceptanceDate,
      allDay: true,
      type: 'deadline',
      parseId,
      propertyAddress,
      status: getEventStatus(acceptanceDate),
    });
  }

  // 2. Initial Deposit Due
  const depositDue = parseDate(data.initial_deposit?.due);
  if (depositDue) {
    events.push({
      id: `${parseId}-deposit`,
      title: `Deposit Due: ${propertyAddress}`,
      start: depositDue,
      end: depositDue,
      allDay: true,
      type: 'deposit',
      parseId,
      propertyAddress,
      status: getEventStatus(depositDue),
    });
  }

  // 3. Contingency Removal Dates (calculated from acceptance date)
  if (acceptanceDate && data.contingencies) {
    const contingencies = data.contingencies;

    // Loan Contingency
    if (contingencies.loan_days && typeof contingencies.loan_days === 'number') {
      const loanDate = calculateContingencyDate(acceptanceDate, contingencies.loan_days);
      events.push({
        id: `${parseId}-loan-contingency`,
        title: `Loan Contingency Removal: ${propertyAddress}`,
        start: loanDate,
        end: loanDate,
        allDay: true,
        type: 'contingency',
        parseId,
        propertyAddress,
        status: getEventStatus(loanDate),
      });
    }

    // Appraisal Contingency
    if (contingencies.appraisal_days && typeof contingencies.appraisal_days === 'number') {
      const appraisalDate = calculateContingencyDate(acceptanceDate, contingencies.appraisal_days);
      events.push({
        id: `${parseId}-appraisal-contingency`,
        title: `Appraisal Contingency Removal: ${propertyAddress}`,
        start: appraisalDate,
        end: appraisalDate,
        allDay: true,
        type: 'contingency',
        parseId,
        propertyAddress,
        status: getEventStatus(appraisalDate),
      });
    }

    // Investigation/Inspection Contingency
    if (contingencies.investigation_days && typeof contingencies.investigation_days === 'number') {
      const investigationDate = calculateContingencyDate(acceptanceDate, contingencies.investigation_days);
      events.push({
        id: `${parseId}-investigation-contingency`,
        title: `Investigation Contingency Removal: ${propertyAddress}`,
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

  // 4. Close of Escrow
  let closeDate: Date | null = null;

  if (typeof data.close_of_escrow === 'number' && acceptanceDate) {
    // Days after acceptance
    closeDate = calculateContingencyDate(acceptanceDate, data.close_of_escrow);
  } else if (typeof data.close_of_escrow === 'string') {
    // Specific date
    closeDate = parseDate(data.close_of_escrow);
  }

  if (closeDate) {
    events.push({
      id: `${parseId}-closing`,
      title: `CLOSING: ${propertyAddress}`,
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
