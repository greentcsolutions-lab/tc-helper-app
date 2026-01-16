// src/lib/google-calendar/sync-timeline-events.ts
// Syncs timeline events from Parse to Google Calendar

import { getGoogleCalendarClient } from './client';
import { prisma } from '@/lib/prisma';
import { TimelineDataStructured, TimelineEventData, STANDARD_TIMELINE_EVENTS } from '@/types/timeline';
import { EVENT_COLORS } from '@/types/calendar';

/**
 * Syncs all timeline events from a parse to Google Calendar
 * This creates a 1:1 mirror of the timeline view in Google Calendar
 */
export async function syncTimelineEventsToCalendar(
  parseId: string,
  userId: string
): Promise<{ success: boolean; eventsSynced: number; error?: string }> {
  try {
    const calendar = await getGoogleCalendarClient(userId);
    if (!calendar) {
      return { success: false, eventsSynced: 0, error: 'Calendar client not available' };
    }

    const settings = await prisma.calendarSettings.findUnique({
      where: { userId },
    });

    if (!settings || !settings.syncEnabled || !settings.primaryCalendarId) {
      return { success: false, eventsSynced: 0, error: 'Calendar sync not enabled' };
    }

    // Get the parse with timeline data
    const parse = await prisma.parse.findUnique({
      where: { id: parseId },
      select: {
        id: true,
        userId: true,
        propertyAddress: true,
        timelineDataStructured: true,
        status: true,
      },
    });

    if (!parse || parse.userId !== userId) {
      return { success: false, eventsSynced: 0, error: 'Parse not found' };
    }

    // Don't sync archived transactions
    if (parse.status === 'ARCHIVED') {
      return { success: true, eventsSynced: 0 };
    }

    const timelineData = (parse.timelineDataStructured as TimelineDataStructured) || {};
    let eventsSynced = 0;

    // Iterate through all timeline events
    for (const [eventKey, eventData] of Object.entries(timelineData)) {
      // Skip waived events
      if (eventData.waived) {
        continue;
      }

      // Skip events without dates
      if (!eventData.effectiveDate) {
        continue;
      }

      // Create or update calendar event
      const result = await syncSingleTimelineEvent(
        calendar,
        settings.primaryCalendarId,
        parse.propertyAddress || 'Unknown Property',
        eventKey,
        eventData,
        parseId
      );

      if (result.googleEventId) {
        // Store the calendar event ID back in the timeline data
        eventData.googleCalendarEventId = result.googleEventId;
        eventsSynced++;
      }
    }

    // Save updated timeline data with calendar event IDs
    await prisma.parse.update({
      where: { id: parseId },
      data: {
        timelineDataStructured: timelineData,
      },
    });

    return { success: true, eventsSynced };
  } catch (error) {
    console.error('Error syncing timeline events to calendar:', error);
    return {
      success: false,
      eventsSynced: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Syncs a single timeline event to Google Calendar
 */
async function syncSingleTimelineEvent(
  calendar: any,
  calendarId: string,
  propertyAddress: string,
  eventKey: string,
  eventData: TimelineEventData & { googleCalendarEventId?: string },
  parseId: string
): Promise<{ googleEventId?: string; error?: string }> {
  try {
    const eventDate = new Date(eventData.effectiveDate!);
    const endDate = new Date(eventDate);
    endDate.setHours(23, 59, 59, 999);

    // Get display name for the event
    const displayName = getDisplayNameForEvent(eventKey, eventData);

    // Build title
    const title = `[TC Helper] ${displayName}`;

    // Build description
    let description = `Property: ${propertyAddress}\n`;
    if (eventData.description) {
      description += `${eventData.description}\n`;
    }

    // Determine color based on event type
    let colorId: string = EVENT_COLORS.TIMELINE;
    if (eventKey.includes('contingency') || eventKey.includes('Contingency')) {
      colorId = EVENT_COLORS.CUSTOM; // Cyan for contingencies
    } else if (eventKey === STANDARD_TIMELINE_EVENTS.CLOSING || eventKey === 'closing') {
      colorId = EVENT_COLORS.ESCROW; // Green for closing
    } else if (eventKey.includes('deposit') || eventKey.includes('Deposit')) {
      colorId = EVENT_COLORS.ESCROW; // Green for deposits
    }

    const calendarEvent = {
      summary: title,
      description: description.trim() || undefined,
      start: {
        date: eventDate.toISOString().split('T')[0],
      },
      end: {
        date: endDate.toISOString().split('T')[0],
      },
      colorId,
      extendedProperties: {
        private: {
          tcHelperParseId: parseId,
          tcHelperTimelineEventKey: eventKey,
          tcHelperType: 'timeline',
        },
      },
    };

    // Check if event already exists in calendar
    if (eventData.googleCalendarEventId) {
      try {
        // Update existing event
        const response = await calendar.events.update({
          calendarId,
          eventId: eventData.googleCalendarEventId,
          requestBody: calendarEvent,
        });

        return { googleEventId: response.data.id || undefined };
      } catch (updateError: any) {
        // If update fails (event might not exist), fall through to search/create
        if (updateError?.code === 404) {
          // Event ID is invalid, clear it and search for existing event
          eventData.googleCalendarEventId = undefined;
        } else {
          throw updateError;
        }
      }
    }

    // Search for existing event by title and date before creating
    if (!eventData.googleCalendarEventId) {
      try {
        const searchResponse = await calendar.events.list({
          calendarId,
          timeMin: eventDate.toISOString(),
          timeMax: endDate.toISOString(),
          q: title,
          singleEvents: true,
        });

        const existingEvents = searchResponse.data.items || [];
        const matchingEvent = existingEvents.find((event: any) => {
          // Check if this event matches our title and has our extended properties
          const isSameTitle = event.summary === title;
          const isSameParse = event.extendedProperties?.private?.tcHelperParseId === parseId;
          const isSameEventKey = event.extendedProperties?.private?.tcHelperTimelineEventKey === eventKey;

          return isSameTitle && (isSameParse || isSameEventKey);
        });

        if (matchingEvent?.id) {
          // Found existing event - update it instead of creating new
          const response = await calendar.events.update({
            calendarId,
            eventId: matchingEvent.id,
            requestBody: calendarEvent,
          });

          return { googleEventId: response.data.id || undefined };
        }
      } catch (searchError) {
        console.error('Error searching for existing event:', searchError);
        // Continue to create new event if search fails
      }
    }

    // No existing event found - create new one
    const response = await calendar.events.insert({
      calendarId,
      requestBody: calendarEvent,
    });

    return { googleEventId: response.data.id || undefined };
  } catch (error) {
    console.error(`Error syncing timeline event ${eventKey}:`, error);
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Gets a user-friendly display name for a timeline event
 */
function getDisplayNameForEvent(eventKey: string, eventData: TimelineEventData): string {
  // Use displayName if provided
  if (eventData.displayName) {
    return eventData.displayName;
  }

  // Map common event keys to display names
  const displayNames: Record<string, string> = {
    acceptance: 'Acceptance',
    initialDeposit: 'Initial Deposit Due',
    sellerDisclosures: 'Seller Disclosures Delivery',
    buyerReviewPeriod: 'Buyer Review Period Ends',
    inspectionContingency: 'Inspection Contingency',
    appraisalContingency: 'Appraisal Contingency',
    loanContingency: 'Loan Contingency',
    closing: 'Closing',
  };

  return displayNames[eventKey] || formatEventKey(eventKey);
}

/**
 * Formats an event key into a readable display name
 * e.g., "inspectionContingency" -> "Inspection Contingency"
 */
function formatEventKey(key: string): string {
  // Insert spaces before capitals and capitalize first letter
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

/**
 * Deletes all timeline calendar events for a parse
 * Called when a parse is deleted or archived
 */
export async function deleteTimelineEventsFromCalendar(
  parseId: string,
  userId: string
): Promise<{ success: boolean; eventsDeleted: number; error?: string }> {
  try {
    const calendar = await getGoogleCalendarClient(userId);
    if (!calendar) {
      return { success: false, eventsDeleted: 0, error: 'Calendar client not available' };
    }

    const settings = await prisma.calendarSettings.findUnique({
      where: { userId },
    });

    if (!settings || !settings.primaryCalendarId) {
      return { success: true, eventsDeleted: 0 };
    }

    // Get the parse with timeline data
    const parse = await prisma.parse.findUnique({
      where: { id: parseId },
      select: {
        timelineDataStructured: true,
      },
    });

    if (!parse) {
      return { success: false, eventsDeleted: 0, error: 'Parse not found' };
    }

    const timelineData = (parse.timelineDataStructured as TimelineDataStructured) || {};
    let eventsDeleted = 0;

    // Delete each calendar event
    for (const eventData of Object.values(timelineData)) {
      const typedEventData = eventData as TimelineEventData & { googleCalendarEventId?: string };

      if (typedEventData.googleCalendarEventId) {
        try {
          await calendar.events.delete({
            calendarId: settings.primaryCalendarId,
            eventId: typedEventData.googleCalendarEventId,
          });
          eventsDeleted++;
        } catch (error) {
          console.error(`Failed to delete calendar event ${typedEventData.googleCalendarEventId}:`, error);
        }
      }
    }

    return { success: true, eventsDeleted };
  } catch (error) {
    console.error('Error deleting timeline events from calendar:', error);
    return {
      success: false,
      eventsDeleted: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
