// src/lib/google-calendar/webhook.ts
// Google Calendar Push Notifications (webhooks) management

import { v4 as uuidv4 } from 'uuid';
import { getGoogleCalendarClient } from './client';
import prisma from '@/lib/prisma';

/**
 * Sets up a webhook (push notification channel) for a user's calendar
 * This enables real-time updates when calendar events change
 */
export async function setupWebhook(userId: string): Promise<{
  success: boolean;
  channelId?: string;
  resourceId?: string;
  expiration?: Date;
  error?: string;
}> {
  try {
    const calendar = await getGoogleCalendarClient(userId);
    if (!calendar) {
      return { success: false, error: 'Calendar client not available' };
    }

    const settings = await prisma.calendarSettings.findUnique({
      where: { userId },
    });

    if (!settings || !settings.primaryCalendarId) {
      return { success: false, error: 'Calendar not configured' };
    }

    // Stop existing webhook if any
    if (settings.webhookChannelId && settings.webhookResourceId) {
      await stopWebhook(userId);
    }

    // Create new channel
    const channelId = uuidv4();
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/google-calendar/webhook`;

    try {
      const response = await calendar.events.watch({
        calendarId: settings.primaryCalendarId,
        requestBody: {
          id: channelId,
          type: 'web_hook',
          address: webhookUrl,
          params: {
            ttl: '604800', // 7 days in seconds
          },
        },
      });

      const expiration = response.data.expiration
        ? new Date(parseInt(response.data.expiration))
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Default 7 days

      // Save webhook details
      await prisma.calendarSettings.update({
        where: { userId },
        data: {
          webhookChannelId: channelId,
          webhookResourceId: response.data.resourceId || null,
          webhookExpiration: expiration,
        },
      });

      return {
        success: true,
        channelId,
        resourceId: response.data.resourceId || undefined,
        expiration,
      };
    } catch (error) {
      console.error('Error setting up webhook:', error);
      return { success: false, error: 'Failed to create webhook' };
    }
  } catch (error) {
    console.error('Error in setupWebhook:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Stops a webhook (push notification channel) for a user
 */
export async function stopWebhook(userId: string): Promise<boolean> {
  try {
    const calendar = await getGoogleCalendarClient(userId);
    if (!calendar) {
      return false;
    }

    const settings = await prisma.calendarSettings.findUnique({
      where: { userId },
    });

    if (!settings || !settings.webhookChannelId || !settings.webhookResourceId) {
      return true; // Nothing to stop
    }

    try {
      await calendar.channels.stop({
        requestBody: {
          id: settings.webhookChannelId,
          resourceId: settings.webhookResourceId,
        },
      });

      await prisma.calendarSettings.update({
        where: { userId },
        data: {
          webhookChannelId: null,
          webhookResourceId: null,
          webhookExpiration: null,
        },
      });

      return true;
    } catch (error) {
      console.error('Error stopping webhook:', error);
      return false;
    }
  } catch (error) {
    console.error('Error in stopWebhook:', error);
    return false;
  }
}

/**
 * Renews a webhook if it's close to expiration
 * Should be called periodically (e.g., daily cron job)
 */
export async function renewWebhookIfNeeded(userId: string): Promise<boolean> {
  try {
    const settings = await prisma.calendarSettings.findUnique({
      where: { userId },
    });

    if (!settings || !settings.webhookExpiration) {
      return false;
    }

    // Renew if expiring within 24 hours
    const expiresIn = settings.webhookExpiration.getTime() - Date.now();
    const oneDayInMs = 24 * 60 * 60 * 1000;

    if (expiresIn < oneDayInMs) {
      const result = await setupWebhook(userId);
      return result.success;
    }

    return true; // No renewal needed
  } catch (error) {
    console.error('Error renewing webhook:', error);
    return false;
  }
}

/**
 * Renews all webhooks that are close to expiration
 * Called by a cron job
 */
export async function renewAllWebhooks(): Promise<{
  totalChecked: number;
  totalRenewed: number;
  errors: number;
}> {
  let totalChecked = 0;
  let totalRenewed = 0;
  let errors = 0;

  try {
    const settings = await prisma.calendarSettings.findMany({
      where: {
        syncEnabled: true,
        webhookExpiration: {
          not: null,
        },
      },
    });

    totalChecked = settings.length;

    for (const setting of settings) {
      const renewed = await renewWebhookIfNeeded(setting.userId);
      if (renewed) {
        totalRenewed++;
      } else {
        errors++;
      }
    }

    return { totalChecked, totalRenewed, errors };
  } catch (error) {
    console.error('Error renewing all webhooks:', error);
    return { totalChecked, totalRenewed, errors: totalChecked };
  }
}
