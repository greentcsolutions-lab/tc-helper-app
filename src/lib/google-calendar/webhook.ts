// src/lib/google-calendar/webhook.ts
// Google Calendar Push Notifications (webhooks) management

import { v4 as uuidv4 } from 'uuid';
import { getGoogleCalendarClient } from './client';
import { prisma } from '@/lib/prisma';

/**
 * Sets up a webhook (push notification channel) for a user's calendar
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

    // 1. Stop existing webhook if it exists to avoid duplicates
    if (settings.webhookChannelId && settings.webhookResourceId) {
      try {
        await calendar.channels.stop({
          requestBody: {
            id: settings.webhookChannelId,
            resourceId: settings.webhookResourceId,
          },
        });
      } catch (e) {
        console.warn('Could not stop old webhook, might be already expired');
      }
    }

    // 2. Create new channel
    const channelId = uuidv4();
    // Ensure this URL is publicly accessible
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/google-calendar/webhook`;

    console.log(`[Webhook Setup] Creating watch channel for user ${userId}`);
    console.log(`[Webhook Setup] Webhook URL: ${webhookUrl}`);
    console.log(`[Webhook Setup] Channel ID: ${channelId}`);

    if (!process.env.NEXT_PUBLIC_APP_URL) {
      console.error('[Webhook Setup] NEXT_PUBLIC_APP_URL is not set!');
      return { success: false, error: 'NEXT_PUBLIC_APP_URL environment variable is not set' };
    }

    const response = await calendar.events.watch({
      calendarId: settings.primaryCalendarId,
      requestBody: {
        id: channelId,
        type: 'web_hook',
        address: webhookUrl,
      },
    });

    console.log(`[Webhook Setup] Watch created successfully. Resource ID: ${response.data.resourceId}, Expiration: ${response.data.expiration}`);

    const expiration = response.data.expiration 
      ? new Date(parseInt(response.data.expiration)) 
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // 3. Store the new webhook details and RESET the sync token
    // We reset the sync token here to ensure the next sync is a clean state for the new channel
    await prisma.calendarSettings.update({
      where: { userId },
      data: {
        webhookChannelId: channelId,
        webhookResourceId: response.data.resourceId,
        webhookExpiration: expiration,
        // Resetting memory fields for the new watch channel
        lastSyncStatus: 'SUCCESS',
        lastSyncError: null,
      },
    });

    return {
      success: true,
      channelId,
      resourceId: response.data.resourceId || undefined,
      expiration,
    };
  } catch (error: any) {
    console.error('Error setting up webhook:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Stops an existing webhook for a user
 */
export async function stopWebhook(userId: string): Promise<{
  success: boolean;
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

    if (!settings || !settings.webhookChannelId || !settings.webhookResourceId) {
      // No webhook to stop
      return { success: true };
    }

    try {
      await calendar.channels.stop({
        requestBody: {
          id: settings.webhookChannelId,
          resourceId: settings.webhookResourceId,
        },
      });

      console.log(`[Webhook] Stopped webhook for user ${userId}`);
    } catch (e: any) {
      // If webhook already expired or doesn't exist, that's fine
      if (e.code === 404 || e.code === 410) {
        console.log(`[Webhook] Webhook already expired or doesn't exist for user ${userId}`);
      } else {
        throw e;
      }
    }

    // Clear webhook data from database
    await prisma.calendarSettings.update({
      where: { userId },
      data: {
        webhookChannelId: null,
        webhookResourceId: null,
        webhookExpiration: null,
      },
    });

    return { success: true };
  } catch (error: any) {
    console.error('[Webhook] Error stopping webhook:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Automatically renews webhooks expiring within the next 24 hours
 * This should be called by a daily Cron Job
 */
export async function renewAllWebhooks(): Promise<{
  totalChecked: number;
  totalRenewed: number;
  errors: number;
}> {
  let totalChecked = 0;
  let totalRenewed = 0;
  let errors = 0;

  const expiringSoon = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const settingsToRenew = await prisma.calendarSettings.findMany({
    where: {
      syncEnabled: true,
      OR: [
        { webhookExpiration: { lt: expiringSoon } },
        { webhookChannelId: null }
      ]
    },
  });

  totalChecked = settingsToRenew.length;

  for (const setting of settingsToRenew) {
    const result = await setupWebhook(setting.userId);
    if (result.success) {
      totalRenewed++;
    } else {
      errors++;
      console.error(`Failed to renew webhook for user ${setting.userId}:`, result.error);
    }
  }

  return { totalChecked, totalRenewed, errors };
}