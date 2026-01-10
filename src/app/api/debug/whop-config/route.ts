/**
 * Debug endpoint to verify Whop configuration
 *
 * GET /api/debug/whop-config
 *
 * IMPORTANT: Remove this endpoint before going to production!
 */

import { NextResponse } from 'next/server';
import { WHOP_PLANS } from '@/lib/whop';

export async function GET() {
  const config = {
    hasApiKey: !!process.env.WHOP_API_KEY,
    apiKeyPrefix: process.env.WHOP_API_KEY?.substring(0, 15) + '...',
    hasWebhookSecret: !!process.env.WHOP_WEBHOOK_SECRET,
    webhookSecretPrefix: process.env.WHOP_WEBHOOK_SECRET?.substring(0, 10) + '...',
    appUrl: process.env.NEXT_PUBLIC_APP_URL || 'NOT SET (using localhost:3000)',
    plans: WHOP_PLANS,
    nodeEnv: process.env.NODE_ENV,
    note: 'Make sure your plan IDs start with "plan_" not "prod_"',
  };

  return NextResponse.json(config);
}
