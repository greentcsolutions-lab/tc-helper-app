/**
 * Debug endpoint to verify Whop configuration
 *
 * GET /api/debug/whop-config
 *
 * IMPORTANT: Remove this endpoint before going to production!
 */

import { NextResponse } from 'next/server';
import { WHOP_PRODUCTS } from '@/lib/whop';

export async function GET() {
  const config = {
    hasApiKey: !!process.env.WHOP_API_KEY,
    apiKeyPrefix: process.env.WHOP_API_KEY?.substring(0, 10) + '...',
    hasWebhookSecret: !!process.env.WHOP_WEBHOOK_SECRET,
    webhookSecretPrefix: process.env.WHOP_WEBHOOK_SECRET?.substring(0, 10) + '...',
    appUrl: process.env.NEXT_PUBLIC_APP_URL || 'NOT SET (using localhost:3000)',
    products: WHOP_PRODUCTS,
    nodeEnv: process.env.NODE_ENV,
  };

  return NextResponse.json(config);
}
