// src/lib/google-calendar/calendar-init.ts
// Initialize Google Calendar calendars for TC Helper

import { calendar_v3 } from 'googleapis';
import { getGoogleCalendarClient } from './client';
import { prisma } from '@/lib/prisma';
import { setupWebhook } from './webhook';

/**
 * Finds or creates the TC Helper calendars for a user
 * This is the "Handshake" function called after OAuth is complete
 */
export async function initializeCalendars(userId: string): Promise<{
  primaryCalendarId: string | null;
  error?: string;
}> {
  try {
    const calendar = await getGoogleCalendarClient(userId);

    if (!calendar) {
      return { primaryCalendarId: null, error: 'Failed to create Google Calendar client' };
    }

    // 1. Check existing settings
    const settings = await prisma.calendarSettings.findUnique({
      where: { userId },
    });

    let primaryCalendarId = settings?.primaryCalendarId;

    // 2. Verify or Create the Primary Calendar
    if (primaryCalendarId) {
      try {
        await calendar.calendars.get({ calendarId: primaryCalendarId });
      } catch (error) {
        console.log('Primary calendar no longer exists, creating a new one.');
        primaryCalendarId = null;
      }
    }

    if (!primaryCalendarId) {
      const newCal = await calendar.calendars.insert({
        requestBody: {
          summary: 'TC Helper - Transactions',
          description: 'Real estate transaction deadlines and tasks',
          timeZone: 'America/New_York',
        },
      });
      primaryCalendarId = newCal.data.id || null;
    }

    if (!primaryCalendarId) throw new Error("Could not create primary calendar");

    // 3. SECURE THE HANDSHAKE
    // We update all memory fields to ensure the UI loop is broken immediately
    await prisma.calendarSettings.update({
      where: { userId },
      data: {
        primaryCalendarId,
        syncEnabled: true,
        initialSyncCompleted: true, // Crucial for breaking the "Connect" button loop
        lastSyncStatus: 'SUCCESS',
        lastSyncedAt: new Date(),
        lastSyncError: null,
        // Reset sync token to null to force a fresh start on the first webhook
        nextSyncToken: null,
        // Clear disconnectedAt if user reconnects (resets 30-day deletion countdown)
        disconnectedAt: null,
      },
    });

    // 4. Initialize the Webhook
    // This will set up the watch channel for real-time notifications
    console.log(`[Calendar Init] Setting up webhook for user ${userId}...`);
    const webhookResult = await setupWebhook(userId);

    if (!webhookResult.success) {
      console.warn('[Calendar Init] Webhook setup failed, but settings are saved:', webhookResult.error);
    } else {
      console.log(`[Calendar Init] Webhook setup successful. Channel ID: ${webhookResult.channelId}, Expiration: ${webhookResult.expiration}`);
    }

    return { primaryCalendarId };
  } catch (error: any) {
    console.error('Error initializing calendars:', error);
    
    // Even if it fails, try to mark the attempt so the user isn't stuck
    await prisma.calendarSettings.update({
      where: { userId },
      data: {
        lastSyncStatus: 'ERROR',
        lastSyncError: error.message || 'Initialization failed'
      }
    }).catch(() => {});

    return { primaryCalendarId: null, error: error.message };
  }
}