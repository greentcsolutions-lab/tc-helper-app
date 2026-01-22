// src/app/api/google-calendar/debug-sync/route.ts
// Diagnostic endpoint to manually test calendar sync and webhook status

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { syncCalendarToApp } from '@/lib/google-calendar/calendar-to-app';

/**
 * GET endpoint to check webhook status and calendar settings
 */
export async function GET(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const settings = await prisma.calendarSettings.findUnique({
      where: { userId: user.id },
    });

    if (!settings) {
      return NextResponse.json({ error: 'No calendar settings found' }, { status: 404 });
    }

    // Check environment variables
    const envCheck = {
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'NOT SET',
      webhookUrl: process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL}/api/google-calendar/webhook`
        : 'CANNOT CONSTRUCT - NEXT_PUBLIC_APP_URL NOT SET',
    };

    // Return diagnostic information
    return NextResponse.json({
      userId: user.id,
      clerkId: clerkUserId,
      calendarSettings: {
        primaryCalendarId: settings.primaryCalendarId,
        syncEnabled: settings.syncEnabled,
        initialSyncCompleted: settings.initialSyncCompleted,
        webhookChannelId: settings.webhookChannelId,
        webhookResourceId: settings.webhookResourceId,
        webhookExpiration: settings.webhookExpiration,
        lastSyncedAt: settings.lastSyncedAt,
        lastSyncStatus: settings.lastSyncStatus,
        lastSyncError: settings.lastSyncError,
        nextSyncToken: settings.nextSyncToken ? 'SET' : 'NOT SET',
      },
      environment: envCheck,
      webhookStatus: {
        hasChannelId: !!settings.webhookChannelId,
        hasResourceId: !!settings.webhookResourceId,
        hasExpiration: !!settings.webhookExpiration,
        isExpired: settings.webhookExpiration ? new Date(settings.webhookExpiration) < new Date() : null,
        expiresIn: settings.webhookExpiration
          ? `${Math.round((new Date(settings.webhookExpiration).getTime() - Date.now()) / (1000 * 60 * 60))} hours`
          : 'N/A',
      },
    });
  } catch (error: any) {
    console.error('[Debug Sync] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST endpoint to manually trigger sync and log detailed information
 */
export async function POST(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    console.log(`[Debug Sync] Manual sync triggered for user ${user.id}`);
    console.log(`[Debug Sync] Webhook URL would be: ${process.env.NEXT_PUBLIC_APP_URL}/api/google-calendar/webhook`);

    const settings = await prisma.calendarSettings.findUnique({
      where: { userId: user.id },
    });

    if (!settings) {
      return NextResponse.json({ error: 'No calendar settings found' }, { status: 404 });
    }

    console.log(`[Debug Sync] Settings found:`, {
      syncEnabled: settings.syncEnabled,
      primaryCalendarId: settings.primaryCalendarId,
      webhookChannelId: settings.webhookChannelId,
      webhookExpiration: settings.webhookExpiration,
    });

    if (!settings.syncEnabled || !settings.primaryCalendarId) {
      return NextResponse.json({
        success: false,
        error: 'Calendar sync not enabled or calendar not configured',
      });
    }

    // Manually trigger the sync
    console.log(`[Debug Sync] Calling syncCalendarToApp...`);
    const result = await syncCalendarToApp(user.id);

    console.log(`[Debug Sync] Sync completed:`, {
      success: result.success,
      totalProcessed: result.totalProcessed,
      totalCreated: result.totalCreated,
      totalUpdated: result.totalUpdated,
      totalDeleted: result.totalDeleted,
      error: result.error,
    });

    return NextResponse.json({
      success: result.success,
      totalProcessed: result.totalProcessed,
      totalCreated: result.totalCreated,
      totalUpdated: result.totalUpdated,
      totalDeleted: result.totalDeleted,
      error: result.error,
      debugInfo: {
        webhookChannelId: settings.webhookChannelId,
        webhookExpiration: settings.webhookExpiration,
        isWebhookExpired: settings.webhookExpiration
          ? new Date(settings.webhookExpiration) < new Date()
          : null,
      },
    });
  } catch (error: any) {
    console.error('[Debug Sync] Error during manual sync:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
