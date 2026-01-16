// src/app/api/google-calendar/webhook/route.ts
// Webhook handler for Google Calendar push notifications

import { NextRequest, NextResponse } from 'next/server';
import { syncCalendarToApp } from '@/lib/google-calendar/calendar-to-app';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    // Get headers from Google Calendar push notification
    const channelId = request.headers.get('x-goog-channel-id');
    const resourceState = request.headers.get('x-goog-resource-state');
    const resourceId = request.headers.get('x-goog-resource-id');

    console.log('Webhook received:', {
      channelId,
      resourceState,
      resourceId,
    });

    if (!channelId || !resourceId) {
      return NextResponse.json({ error: 'Missing required headers' }, { status: 400 });
    }

    // Find the user associated with this webhook channel
    const settings = await prisma.calendarSettings.findFirst({
      where: {
        webhookChannelId: channelId,
        webhookResourceId: resourceId,
      },
    });

    if (!settings) {
      console.log('No settings found for webhook channel:', channelId);
      return NextResponse.json({ error: 'Unknown webhook channel' }, { status: 404 });
    }

    // Only process 'sync' events (ignore 'exists' which is initial verification)
    if (resourceState === 'sync') {
      console.log('Webhook sync verification received');
      return NextResponse.json({ success: true });
    }

    // Sync calendar changes to app
    console.log('Syncing calendar changes for user:', settings.userId);
    const result = await syncCalendarToApp(settings.userId);

    if (!result.success) {
      console.error('Sync failed:', result.error);
      await prisma.calendarSettings.update({
        where: { id: settings.id },
        data: {
          lastSyncError: result.error || 'Sync failed',
        },
      });
    } else {
      console.log('Sync successful:', {
        totalProcessed: result.totalProcessed,
        totalCreated: result.totalCreated,
        totalUpdated: result.totalUpdated,
        totalDeleted: result.totalDeleted,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in webhook handler:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Handle webhook verification (GET request)
export async function GET(request: NextRequest) {
  // Google may send GET requests for webhook verification
  return NextResponse.json({ success: true });
}
