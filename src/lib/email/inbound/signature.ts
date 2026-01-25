/**
 * Resend webhook signature verification
 */

import { createHmac } from 'crypto';

/**
 * Verify Resend webhook signature using HMAC-SHA256
 * @param payload - Raw request body as string
 * @param signature - Signature from request headers (resend-signature)
 * @param secret - Webhook secret from environment (RESEND_WEBHOOK_SECRET)
 * @returns true if signature is valid
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature || !secret) {
    console.error('[webhook-signature] Missing signature or secret');
    return false;
  }

  try {
    const hmac = createHmac('sha256', secret);
    const digest = `sha256=${hmac.update(payload).digest('hex')}`;
    return digest === signature;
  } catch (error) {
    console.error(
      '[webhook-signature] Signature verification error:',
      error instanceof Error ? error.message : 'Unknown'
    );
    return false;
  }
}

/**
 * Get and validate the webhook secret from environment
 * @returns webhook secret or null if not configured
 */
export function getWebhookSecret(): string | null {
  const secret = process.env.RESEND_WEBHOOK_SECRET;

  if (!secret) {
    console.error('[webhook-signature] RESEND_WEBHOOK_SECRET not configured');
    return null;
  }

  return secret;
}
