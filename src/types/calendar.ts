// src/types/calendar.ts
// Google Calendar integration types

// ============================================================================
// CALENDAR SETTINGS
// ============================================================================

export interface CalendarSettings {
  id: string;
  userId: string;

  // Google OAuth Tokens
  googleAccessToken: string | null;
  googleRefreshToken: string | null;
  googleTokenExpiry: Date | null;

  // Calendar IDs
  primaryCalendarId: string | null; // "TC Helper" calendar
  archivedCalendarId: string | null; // "TC Helper Archived Events" calendar

  // Sync Settings
  syncEnabled: boolean;
  includeFullDetails: boolean;
  syncNonAppEvents: boolean;
  excludeFinancialData: boolean;

  // Webhook Configuration
  webhookChannelId: string | null;
  webhookResourceId: string | null;
  webhookExpiration: Date | null;

  // Sync Status
  lastSyncAt: Date | null;
  lastSyncError: string | null;
  initialSyncCompleted: boolean;

  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// CALENDAR EVENT
// ============================================================================

export interface CalendarEvent {
  id: string;
  userId: string;

  // Google Calendar Event Details
  googleEventId: string;
  calendarId: string;

  // Event Details
  title: string;
  description: string | null;
  start: Date;
  end: Date;
  allDay: boolean;

  // Classification
  isAppEvent: boolean; // true = created by app, false = external event
  matchedPropertyAddress: string | null;
  inferredTaskTypes: string[];

  // Sync Metadata
  lastSyncedAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// GOOGLE CALENDAR API TYPES
// ============================================================================

export interface GoogleCalendarEventDateTime {
  date?: string; // For all-day events (YYYY-MM-DD)
  dateTime?: string; // For timed events (ISO 8601)
  timeZone?: string;
}

export interface GoogleCalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  start: GoogleCalendarEventDateTime;
  end: GoogleCalendarEventDateTime;
  colorId?: string;
  extendedProperties?: {
    private?: {
      tcHelperId?: string; // Our internal task ID
      tcHelperType?: string; // "task" | "timeline"
      tcHelperParseId?: string; // Link to transaction
    };
  };
}

export interface GoogleCalendar {
  id: string;
  summary: string;
  description?: string;
  timeZone?: string;
  backgroundColor?: string;
  foregroundColor?: string;
}

// ============================================================================
// SYNC OPERATIONS
// ============================================================================

export interface SyncOperation {
  type: 'create' | 'update' | 'delete';
  taskId: string;
  googleEventId?: string;
  success: boolean;
  error?: string;
}

export interface SyncResult {
  success: boolean;
  operations: SyncOperation[];
  totalSynced: number;
  totalErrors: number;
  error?: string;
}

// ============================================================================
// PROPERTY MATCHING
// ============================================================================

export interface PropertyMatch {
  propertyAddress: string;
  parseId: string;
  confidence: 'exact' | 'fuzzy' | 'none';
  matchScore?: number; // 0-100 for fuzzy matches
}

// ============================================================================
// AI INFERENCE (BASIC PLAN FEATURE)
// ============================================================================

export interface TaskTypeInferenceResult {
  taskTypes: string[];
  confidence: number; // 0-100
  reasoning?: string;
}

// ============================================================================
// CALENDAR COLORS
// ============================================================================

// Google Calendar color IDs
// https://developers.google.com/calendar/api/v3/reference/colors
export const CALENDAR_COLORS = {
  TC_HELPER_PRIMARY: '9', // Blue
  TC_HELPER_ARCHIVED: '8', // Gray
  NON_APP_EVENT: '8', // Gray (for display)
} as const;

export const EVENT_COLORS = {
  TIMELINE: '9', // Blue
  BROKER: '5', // Yellow
  ESCROW: '10', // Green
  LENDER: '4', // Orange
  CUSTOM: '7', // Cyan
  OVERDUE: '11', // Red
} as const;
