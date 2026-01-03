// src/lib/dates/extract-timeline-events.ts
// Version: 1.0.0 - Timeline event extraction from parsed contracts
// Extracts all important dates from parsed contract data

import { addDays, parseISO, isValid, isFuture, isPast } from "date-fns";

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
 * Simplifies a full address to just the street address
 * Example: "123 Main St, Los Angeles, CA 90001" -> "123 Main St"
 */
function simplifyAddress(address: string | undefined): string {
  if (!address) return "Unknown Property";

  // Split by comma and take the first part (street address)
  const parts = address.split(',');
  return parts[0].trim();
}

/**
 * Extract all timeline events from a parsed contract
 * Updated to use top-level database fields instead of formatted JSON
 */
export function extractTimelineEvents(parse: any): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const parseId = parse.id;
  const propertyAddress = parse.propertyAddress || 'Unknown Property';
  const simplifiedAddress = simplifyAddress(propertyAddress);

  // 1. Effective Date (Acceptance Date) - Always completed, never overdue
  const acceptanceDate = parseDate(parse.effectiveDate);
  if (acceptanceDate) {
    events.push({
      id: `${parseId}-acceptance`,
      title: `Acceptance: ${simplifiedAddress}`,
      start: acceptanceDate,
      end: acceptanceDate,
      allDay: true,
      type: 'acceptance',
      parseId,
      propertyAddress,
      status: 'completed', // Acceptance dates initialize the workflow and cannot be overdue
    });
  }

  // 2. Initial Deposit Due
  const depositDue = parseDate(parse.initialDepositDueDate);
  if (depositDue) {
    events.push({
      id: `${parseId}-deposit`,
      title: `Deposit Due: ${simplifiedAddress}`,
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
  const sellerDisclosuresDate = parseDate(parse.sellerDeliveryOfDisclosuresDate);
  if (sellerDisclosuresDate) {
    events.push({
      id: `${parseId}-seller-disclosures`,
      title: `Seller Disclosures Due: ${simplifiedAddress}`,
      start: sellerDisclosuresDate,
      end: sellerDisclosuresDate,
      allDay: true,
      type: 'deadline',
      parseId,
      propertyAddress,
      status: getEventStatus(sellerDisclosuresDate),
    });
  }

  // 4. Contingency Removal Dates (calculated from acceptance date)
  if (acceptanceDate && parse.contingencies) {
    const contingencies = parse.contingencies;

    // Loan Contingency
    if (contingencies.loanDays && typeof contingencies.loanDays === 'number') {
      const loanDate = calculateContingencyDate(acceptanceDate, contingencies.loanDays);
      events.push({
        id: `${parseId}-loan-contingency`,
        title: `Loan Contingency Removal: ${simplifiedAddress}`,
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
    if (contingencies.appraisalDays && typeof contingencies.appraisalDays === 'number') {
      const appraisalDate = calculateContingencyDate(acceptanceDate, contingencies.appraisalDays);
      events.push({
        id: `${parseId}-appraisal-contingency`,
        title: `Appraisal Contingency Removal: ${simplifiedAddress}`,
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
    if (contingencies.inspectionDays && typeof contingencies.inspectionDays === 'number') {
      const investigationDate = calculateContingencyDate(acceptanceDate, contingencies.inspectionDays);
      events.push({
        id: `${parseId}-investigation-contingency`,
        title: `Investigation Contingency Removal: ${simplifiedAddress}`,
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

  // 5. Close of Escrow / Closing Date
  let closeDate: Date | null = null;

  if (typeof parse.closingDate === 'number' && acceptanceDate) {
    // Days after acceptance
    closeDate = calculateContingencyDate(acceptanceDate, parse.closingDate);
  } else if (typeof parse.closingDate === 'string') {
    // Specific date
    closeDate = parseDate(parse.closingDate);
  }

  if (closeDate) {
    events.push({
      id: `${parseId}-closing`,
      title: `CLOSING: ${simplifiedAddress}`,
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
