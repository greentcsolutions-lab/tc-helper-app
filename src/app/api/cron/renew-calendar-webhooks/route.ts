// src/app/api/cron/renew-calendar-webhooks/route.ts
// Cron job to renew Google Calendar webhooks before expiration

import { NextRequest, NextResponse } from 'next/server';
import { renewAllWebhooks } from '@/lib/google-calendar/webhook';

export async function GET(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request (optional but recommended)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Starting webhook renewal cron job...');

    const result = await renewAllWebhooks();

    console.log('Webhook renewal complete:', result);

    return NextResponse.json({
      success: true,
      totalChecked: result.totalChecked,
      totalRenewed: result.totalRenewed,
      errors: result.errors,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in webhook renewal cron:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
