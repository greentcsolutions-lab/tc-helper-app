/**
 * Resend webhook endpoint for inbound emails
 * Thin router that delegates to domain-specific handlers
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature, getWebhookSecret } from '@/lib/email/inbound/signature';
import { inboundEmailSchema } from '@/lib/email/types';
import { routeInboundEmail } from '@/lib/email/inbound/router';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Process inbound email webhook from Resend
 * This is a thin router that delegates to the appropriate handler
 */
export async function POST(req: NextRequest) {
  console.log('[webhook-inbound] === NEW INBOUND EMAIL ===');

  // Step 1: Verify webhook signature
  const secret = getWebhookSecret();
  if (!secret) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get('resend-signature');

  if (!verifyWebhookSignature(rawBody, signature, secret)) {
    console.error('[webhook-inbound] Invalid webhook signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  console.log('[webhook-inbound] Signature verified ✓');

  // Step 2: Parse and validate webhook payload
  let emailPayload: any;
  try {
    emailPayload = JSON.parse(rawBody);
  } catch (error) {
    console.error('[webhook-inbound] Failed to parse JSON payload');
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const validation = inboundEmailSchema.safeParse(emailPayload);
  if (!validation.success) {
    console.error('[webhook-inbound] Invalid email payload:', validation.error.format());
    return NextResponse.json({ error: 'Invalid payload structure' }, { status: 400 });
  }

  const payload = validation.data;
  console.log(`[webhook-inbound] Email from: ${payload.from}, to: ${payload.to}`);

  // Step 3: Route to appropriate handler
  try {
    const result = await routeInboundEmail(payload);

    if (!result.success) {
      // Handler gracefully rejected/failed - return 200 to prevent Resend retries
      console.log(`[webhook-inbound] Handler result: ${result.message}`);
      return NextResponse.json({ message: result.message }, { status: 200 });
    }

    // Success
    console.log(`[webhook-inbound] Handler success: ${result.message}`);
    return NextResponse.json(
      {
        message: result.message,
        parseId: result.parseId,
        communicationId: result.communicationId,
      },
      { status: 200 }
    );
  } catch (error) {
    // Unexpected error - log and return 500
    console.error('[webhook-inbound] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown',
      },
      { status: 500 }
    );
  }
}
