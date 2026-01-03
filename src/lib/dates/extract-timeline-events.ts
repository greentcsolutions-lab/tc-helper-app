// src/lib/dates/extract-timeline-events.ts
// Version: 2.0.0 - Updated to use ParseResult structure
// Extracts all important dates from parsed contract data

import { addDays, parseISO, isValid, isFuture } from "date-fns";

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
 * Parses a date string in YYYY-MM-DD or MM/DD/YYYY format
 */
function parseDate(dateStr: string | number | null | undefined): Date | null {
  if (!dateStr) return null;

  // If it's a number of days, return null (needs anchor date)
  if (typeof dateStr === 'number') return null;

  // Try YYYY-MM-DD format first (ISO)
  try {
    const date = parseISO(dateStr);
    if (isValid(date)) return date;
  } catch {
    // Continue to next format
  }

  // Try MM/DD/YYYY format
  const mmddyyyyRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  const match = dateStr.match(mmddyyyyRegex);

  if (match) {
    const [, month, day, year] = match;
    const date = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
    return isValid(date) ? date : null;
  }

  return null;
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
 * Extract all timeline events from a parsed contract using ParseResult structure
 */
export function extractTimelineEvents(parse: any): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const parseId = parse.id;
  const propertyAddress = parse.propertyAddress || 'Unknown Property';

  // 1. Effective Date (Acceptance Date)
  const effectiveDate = parseDate(parse.effectiveDate);
  if (effectiveDate) {
    events.push({
      id: `${parseId}-acceptance`,
      title: `Acceptance: ${propertyAddress}`,
      start: effectiveDate,
      end: effectiveDate,
      allDay: true,
      type: 'deadline',
      parseId,
      propertyAddress,
      status: getEventStatus(effectiveDate),
    });
  }

  // 2. Initial Deposit Due
  const depositDue = parseDate(parse.initialDepositDueDate);
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

  // 3. Seller Delivery of Disclosures
  const sellerDelivery = parseDate(parse.sellerDeliveryOfDisclosuresDate);
  if (sellerDelivery) {
    events.push({
      id: `${parseId}-seller-delivery`,
      title: `Seller Delivery: ${propertyAddress}`,
      start: sellerDelivery,
      end: sellerDelivery,
      allDay: true,
      type: 'deadline',
      parseId,
      propertyAddress,
      status: getEventStatus(sellerDelivery),
    });
  }

  // 4. Contingency Removal Dates
  const contingencies = parse.contingencies;
  if (contingencies) {
    // Inspection Contingency
    const inspectionDate = parseDate(contingencies.inspectionDays);
    if (inspectionDate) {
      events.push({
        id: `${parseId}-inspection-contingency`,
        title: `Inspection Contingency: ${propertyAddress}`,
        start: inspectionDate,
        end: inspectionDate,
        allDay: true,
        type: 'contingency',
        parseId,
        propertyAddress,
        status: getEventStatus(inspectionDate),
      });
    }

    // Appraisal Contingency
    const appraisalDate = parseDate(contingencies.appraisalDays);
    if (appraisalDate) {
      events.push({
        id: `${parseId}-appraisal-contingency`,
        title: `Appraisal Contingency: ${propertyAddress}`,
        start: appraisalDate,
        end: appraisalDate,
        allDay: true,
        type: 'contingency',
        parseId,
        propertyAddress,
        status: getEventStatus(appraisalDate),
      });
    }

    // Loan Contingency
    const loanDate = parseDate(contingencies.loanDays);
    if (loanDate) {
      events.push({
        id: `${parseId}-loan-contingency`,
        title: `Loan Contingency: ${propertyAddress}`,
        start: loanDate,
        end: loanDate,
        allDay: true,
        type: 'contingency',
        parseId,
        propertyAddress,
        status: getEventStatus(loanDate),
      });
    }
  }

  // 5. Close of Escrow
  const closingDate = parseDate(parse.closingDate);
  if (closingDate) {
    events.push({
      id: `${parseId}-closing`,
      title: `CLOSING: ${propertyAddress}`,
      start: closingDate,
      end: closingDate,
      allDay: true,
      type: 'closing',
      parseId,
      propertyAddress,
      status: getEventStatus(closingDate),
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
