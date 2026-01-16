// src/lib/google-calendar/calendar-init.ts
// Initialize Google Calendar calendars for TC Helper

import { calendar_v3 } from 'googleapis';
import { getGoogleCalendarClient } from './client';
import { prisma } from '@/lib/prisma';
import { CALENDAR_COLORS } from '@/types/calendar';

/**
 * Finds or creates the TC Helper calendars for a user
 */
export async function initializeCalendars(userId: string): Promise<{
  primaryCalendarId: string | null;
  archivedCalendarId: string | null;
  error?: string;
}> {
  try {
    const calendar = await getGoogleCalendarClient(userId);

    if (!calendar) {
      return {
        primaryCalendarId: null,
        archivedCalendarId: null,
        error: 'Failed to create Google Calendar client',
      };
    }

    // Check if calendars already exist
    const settings = await prisma.calendarSettings.findUnique({
      where: { userId },
    });

    let primaryCalendarId = settings?.primaryCalendarId;
    let archivedCalendarId = settings?.archivedCalendarId;

    // Verify existing calendars still exist
    if (primaryCalendarId) {
      try {
        await calendar.calendars.get({ calendarId: primaryCalendarId });
      } catch (error) {
        console.log('Primary calendar no longer exists, will create new one');
        primaryCalendarId = null;
      }
    }

    if (archivedCalendarId) {
      try {
        await calendar.calendars.get({ calendarId: archivedCalendarId });
      } catch (error) {
        console.log('Archived calendar no longer exists, will create new one');
        archivedCalendarId = null;
      }
    }

    // Create primary calendar if needed
    if (!primaryCalendarId) {
      const primaryCalendar = await createCalendar(calendar, {
        summary: 'TC Helper',
        description: 'Real estate transaction timeline and tasks from TC Helper app',
        timeZone: 'America/Los_Angeles',
      });

      if (primaryCalendar) {
        primaryCalendarId = primaryCalendar.id || null;
      }
    }

    // Create archived calendar if needed
    if (!archivedCalendarId) {
      const archivedCalendar = await createCalendar(calendar, {
        summary: 'TC Helper Archived Events',
        description: 'Archived events from TC Helper app',
        timeZone: 'America/Los_Angeles',
      });

      if (archivedCalendar) {
        archivedCalendarId = archivedCalendar.id || null;
      }
    }

    // Update settings with calendar IDs
    await prisma.calendarSettings.update({
      where: { userId },
      data: {
        primaryCalendarId: primaryCalendarId || null,
        archivedCalendarId: archivedCalendarId || null,
      },
    });

    return {
      primaryCalendarId: primaryCalendarId || null,
      archivedCalendarId: archivedCalendarId || null,
    };
  } catch (error) {
    console.error('Error initializing calendars:', error);
    return {
      primaryCalendarId: null,
      archivedCalendarId: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Creates a new Google Calendar
 */
async function createCalendar(
  calendar: calendar_v3.Calendar,
  params: {
    summary: string;
    description: string;
    timeZone: string;
  }
): Promise<calendar_v3.Schema$Calendar | null> {
  try {
    const response = await calendar.calendars.insert({
      requestBody: {
        summary: params.summary,
        description: params.description,
        timeZone: params.timeZone,
      },
    });

    return response.data;
  } catch (error) {
    console.error(`Error creating calendar "${params.summary}":`, error);
    return null;
  }
}

/**
 * Deletes the TC Helper calendars (cleanup when disconnecting)
 */
export async function deleteCalendars(userId: string): Promise<boolean> {
  try {
    const calendar = await getGoogleCalendarClient(userId);

    if (!calendar) {
      return false;
    }

    const settings = await prisma.calendarSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      return true;
    }

    // Delete primary calendar
    if (settings.primaryCalendarId) {
      try {
        await calendar.calendars.delete({
          calendarId: settings.primaryCalendarId,
        });
      } catch (error) {
        console.error('Error deleting primary calendar:', error);
      }
    }

    // Delete archived calendar
    if (settings.archivedCalendarId) {
      try {
        await calendar.calendars.delete({
          calendarId: settings.archivedCalendarId,
        });
      } catch (error) {
        console.error('Error deleting archived calendar:', error);
      }
    }

    // Clear calendar IDs from settings
    await prisma.calendarSettings.update({
      where: { userId },
      data: {
        primaryCalendarId: null,
        archivedCalendarId: null,
      },
    });

    return true;
  } catch (error) {
    console.error('Error deleting calendars:', error);
    return false;
  }
}
