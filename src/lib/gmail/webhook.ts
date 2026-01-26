// src/lib/gmail/webhook.ts
// Gmail push notification (watch) utilities

import { getGmailClient } from './client';
import { prisma } from '@/lib/prisma';

// Topic for Gmail push notifications
// This needs to be configured in Google Cloud Pub/Sub
const PUBSUB_TOPIC = process.env.GMAIL_PUBSUB_TOPIC || 'projects/tc-helper/topics/gmail-notifications';

/**
 * Set up Gmail push notifications (watch) for a user
 */
export async function setupGmailWatch(userId: string): Promise<{
  success: boolean;
  historyId?: string;
  expiration?: Date;
  error?: string;
}> {
  const gmail = await getGmailClient(userId);
  if (!gmail) {
    return { success: false, error: 'Gmail not connected' };
  }

  try {
    const response = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        topicName: PUBSUB_TOPIC,
        labelIds: ['INBOX', 'SENT'],
        labelFilterBehavior: 'include',
      },
    });

    const historyId = response.data.historyId;
    const expiration = response.data.expiration
      ? new Date(parseInt(response.data.expiration, 10))
      : null;

    // Store watch info
    await prisma.gmailSettings.update({
      where: { userId },
      data: {
        webhookHistoryId: historyId,
        webhookExpiration: expiration,
      },
    });

    return {
      success: true,
      historyId: historyId || undefined,
      expiration: expiration || undefined,
    };
  } catch (error) {
    console.error('[Gmail] Error setting up watch:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Stop Gmail push notifications for a user
 */
export async function stopGmailWatch(userId: string): Promise<boolean> {
  const gmail = await getGmailClient(userId);
  if (!gmail) {
    return false;
  }

  try {
    await gmail.users.stop({ userId: 'me' });

    // Clear watch info
    await prisma.gmailSettings.update({
      where: { userId },
      data: {
        webhookHistoryId: null,
        webhookExpiration: null,
      },
    });

    return true;
  } catch (error) {
    console.error('[Gmail] Error stopping watch:', error);
    return false;
  }
}

/**
 * Process a Gmail push notification
 * Called when we receive a Pub/Sub message
 */
export async function processGmailNotification(
  userEmail: string,
  historyId: string
): Promise<{
  success: boolean;
  newMessages?: number;
  error?: string;
}> {
  // Find user by email
  const settings = await prisma.gmailSettings.findFirst({
    where: { primaryEmailAddress: userEmail },
    include: { user: { select: { id: true } } },
  });

  if (!settings) {
    return { success: false, error: 'User not found' };
  }

  const userId = settings.user.id;
  const gmail = await getGmailClient(userId);
  if (!gmail) {
    return { success: false, error: 'Gmail not connected' };
  }

  try {
    // Get history since last notification
    const startHistoryId = settings.webhookHistoryId || historyId;

    const historyResponse = await gmail.users.history.list({
      userId: 'me',
      startHistoryId,
      historyTypes: ['messageAdded', 'messageDeleted', 'labelAdded', 'labelRemoved'],
    });

    const historyRecords = historyResponse.data.history || [];
    let newMessageCount = 0;

    for (const record of historyRecords) {
      if (record.messagesAdded) {
        newMessageCount += record.messagesAdded.length;
      }
    }

    // Update stored history ID
    const newHistoryId = historyResponse.data.historyId;
    if (newHistoryId) {
      await prisma.gmailSettings.update({
        where: { userId },
        data: {
          webhookHistoryId: newHistoryId,
          lastSyncedAt: new Date(),
          lastSyncStatus: 'SUCCESS',
        },
      });
    }

    return {
      success: true,
      newMessages: newMessageCount,
    };
  } catch (error) {
    console.error('[Gmail] Error processing notification:', error);

    // Log error to settings
    await prisma.gmailSettings.update({
      where: { userId },
      data: {
        lastSyncStatus: 'ERROR',
        lastSyncError: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check if watch needs renewal (expiring within 1 day)
 */
export async function checkWatchExpiration(userId: string): Promise<boolean> {
  const settings = await prisma.gmailSettings.findUnique({
    where: { userId },
    select: { webhookExpiration: true },
  });

  if (!settings?.webhookExpiration) {
    return true; // No watch set up
  }

  const oneDayFromNow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return settings.webhookExpiration < oneDayFromNow;
}

/**
 * Renew watch if needed
 */
export async function renewWatchIfNeeded(userId: string): Promise<void> {
  const needsRenewal = await checkWatchExpiration(userId);
  if (needsRenewal) {
    await setupGmailWatch(userId);
  }
}
