// src/app/api/google-calendar/webhook/route.ts
// Webhook handler for Google Calendar push notifications

import { NextRequest, NextResponse } from 'next/server';
import { syncCalendarToApp } from '@/lib/google-calendar/calendar-to-app';
import { prisma } from '@/lib/prisma';

/**
 * Handle POST requests from Google Calendar
 * Google sends a POST request here whenever a calendar event is 
 * created, updated, or deleted by the user in the Google UI.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Extract headers sent by Google
    const channelId = request.headers.get('x-goog-channel-id');
    const resourceState = request.headers.get('x-goog-resource-state');
    const resourceId = request.headers.get('x-goog-resource-id');

    // Debugging logs (visible in your server terminal)
    console.log(`[Webhook] Received notification. Channel: ${channelId}, State: ${resourceState}`);

    if (!channelId || !resourceId) {
      return NextResponse.json({ error: 'Missing required headers' }, { status: 400 });
    }

    // 2. Identify the user based on the Webhook IDs stored in our database
    const settings = await prisma.calendarSettings.findFirst({
      where: {
        webhookChannelId: channelId,
        webhookResourceId: resourceId,
      },
    });

    if (!settings) {
      console.error(`[Webhook] No user found for channel: ${channelId}`);
      return NextResponse.json({ error: 'Unknown webhook channel' }, { status: 404 });
    }

    // 3. Handle 'sync' vs 'exists'
    // 'sync' is sent when the webhook is first created (verification)
    // 'exists' (or anything else) means actual data changed
    if (resourceState === 'sync') {
      console.log(`[Webhook] Verification successful for User: ${settings.userId}`);
      return NextResponse.json({ success: true });
    }

    // 4. Trigger the Incremental Sync logic
    console.log(`[Webhook] Triggering sync for User: ${settings.userId} (resourceState: ${resourceState})...`);

    const result = await syncCalendarToApp(settings.userId);

    if (!result.success) {
      console.error(`[Webhook] Sync failed for ${settings.userId}:`, result.error);

      // Update our memory fields with the error
      await prisma.calendarSettings.update({
        where: { id: settings.id },
        data: {
          lastSyncStatus: 'ERROR',
          lastSyncError: result.error || 'Incremental sync failed',
        },
      });
    } else {
      console.log(`[Webhook] Sync complete for ${settings.userId}. Created: ${result.totalCreated}, Updated: ${result.totalUpdated}, Deleted: ${result.totalDeleted}, Processed: ${result.totalProcessed}`);
    }

    // Google expects a 200 OK response to confirm we received the message
    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('[Webhook] Internal Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Handle GET requests (Google sometimes uses these for initial reachability tests)
 */
export async function GET() {
  return NextResponse.json({ status: 'Webhook endpoint active' });
}