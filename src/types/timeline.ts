// src/types/timeline.ts
// Version: 4.0.0 - 2026-01-15
// Structured timeline data types for reworked timeline feature

/**
 * Specifies how a timeline date is determined
 */
export type TimelineDateType = "specified" | "relative";

/**
 * Anchor point for relative dates
 * Can be standard anchors or reference other timeline events
 */
export type TimelineAnchorPoint =
  | "acceptance"
  | "closing"
  | string; // Other timeline event keys (e.g., "sellerDisclosures")

/**
 * Direction for relative dates
 */
export type TimelineDirection = "after" | "before";

/**
 * Type of days used in calculation
 */
export type TimelineDayType = "calendar" | "business";

/**
 * Structured timeline event data extracted from contract
 */
export interface TimelineEventData {
  /**
   * How the date is determined
   */
  dateType: TimelineDateType;

  /**
   * Calculated effective date (YYYY-MM-DD)
   * This is the final date after all calculations
   */
  effectiveDate: string | null;

  /**
   * For relative dates: number of days
   */
  relativeDays?: number;

  /**
   * For relative dates: anchor point reference
   */
  anchorPoint?: TimelineAnchorPoint;

  /**
   * For relative dates: direction from anchor
   */
  direction?: TimelineDirection;

  /**
   * For relative dates: type of days (business or calendar)
   */
  dayType?: TimelineDayType;

  /**
   * For specified dates: the exact date from contract (YYYY-MM-DD)
   */
  specifiedDate?: string;

  /**
   * Optional: display name for this event
   */
  displayName?: string;

  /**
   * Optional: description or notes about this timeline event
   */
  description?: string;
}

/**
 * Collection of all timeline events for a transaction
 * Keys are event identifiers (e.g., "acceptance", "initialDeposit", "closing")
 */
export interface TimelineDataStructured {
  [eventKey: string]: TimelineEventData;
}

/**
 * Standard timeline event keys used across the application
 */
export const STANDARD_TIMELINE_EVENTS = {
  ACCEPTANCE: "acceptance",
  INITIAL_DEPOSIT: "initialDeposit",
  SELLER_DISCLOSURES: "sellerDisclosures",
  BUYER_REVIEW_PERIOD: "buyerReviewPeriod",
  INSPECTION_CONTINGENCY: "inspectionContingency",
  APPRAISAL_CONTINGENCY: "appraisalContingency",
  LOAN_CONTINGENCY: "loanContingency",
  CLOSING: "closing",
} as const;

/**
 * Display text generator for timeline events
 * Formats as: "MM/DD/YYYY (source description)"
 * Examples:
 * - "01/24/2026 (3 business days after acceptance)"
 * - "02/03/2026 (specified)"
 * - "01/31/2026 (7 days after acceptance)"
 */
export function formatTimelineEventDisplay(event: TimelineEventData): string {
  if (!event.effectiveDate) {
    return "Not set";
  }

  // Format the date as MM/DD/YYYY
  const date = new Date(event.effectiveDate);
  const displayDate = `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()}`;

  // Build the source description
  let sourceDescription = "";

  if (event.dateType === "specified") {
    sourceDescription = "specified";
  } else if (event.dateType === "relative" && event.relativeDays !== undefined) {
    const dayTypeText = event.dayType === "business" ? "business days" : "days";
    const directionText = event.direction === "before" ? "before" : "after";
    const anchorText = event.anchorPoint || "acceptance";

    sourceDescription = `${event.relativeDays} ${dayTypeText} ${directionText} ${anchorText}`;
  }

  return `${displayDate} (${sourceDescription})`;
}

/**
 * AI extraction format for timeline events
 * This is what we expect from Claude/Gemini
 */
export interface AITimelineExtraction {
  /**
   * Event identifier (e.g., "initialDeposit", "sellerDisclosures")
   */
  eventKey: string;

  /**
   * Display name for the event
   */
  displayName: string;

  /**
   * How is the date determined
   */
  dateType: TimelineDateType;

  /**
   * For specified dates: the exact date from contract (YYYY-MM-DD or MM/DD/YYYY)
   */
  specifiedDate?: string;

  /**
   * For relative dates: number of days
   */
  relativeDays?: number;

  /**
   * For relative dates: anchor point
   */
  anchorPoint?: TimelineAnchorPoint;

  /**
   * For relative dates: direction
   */
  direction?: TimelineDirection;

  /**
   * For relative dates: type of days
   */
  dayType?: TimelineDayType;

  /**
   * Optional description
   */
  description?: string;
}
