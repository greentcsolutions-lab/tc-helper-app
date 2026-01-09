/**
 * Whop Integration
 *
 * This module handles all Whop-related functionality including:
 * - Checkout session creation for subscriptions and one-time purchases
 * - Webhook signature verification
 * - Plan management and user updates
 */

// Whop Product IDs
export const WHOP_PRODUCTS = {
  BASIC_PLAN: 'prod_qBP7zVT60nXmZ',      // $15/mo or $150/yr
  CREDIT_PACK: 'prod_NolysBAikHLtP',     // $10 for 5 credits
} as const;

// Plan Types
export type PlanType = 'FREE' | 'BASIC';

// Plan Configuration
export interface PlanConfig {
  name: string;
  quota: number;           // Concurrent active transactions
  parseLimit: number;      // AI parses (FREE: total, BASIC: per month)
  customTaskLimit: number; // Custom tasks limit
  price: {
    monthly: number;
    annual: number;
  };
}

export const PLAN_CONFIGS: Record<PlanType, PlanConfig> = {
  FREE: {
    name: 'Free',
    quota: 1,              // 1 concurrent transaction
    parseLimit: 1,         // 1 AI parse total (never resets)
    customTaskLimit: 1,    // 1 custom task
    price: {
      monthly: 0,
      annual: 0,
    },
  },
  BASIC: {
    name: 'Basic',
    quota: 5,              // 5 concurrent transactions
    parseLimit: 5,         // 5 AI parses per month (resets monthly)
    customTaskLimit: 10,   // 10 custom tasks
    price: {
      monthly: 15,
      annual: 150,
    },
  },
};

/**
 * Get Whop API Key from environment
 */
export function getWhopApiKey(): string {
  const apiKey = process.env.WHOP_API_KEY;
  if (!apiKey) {
    throw new Error('WHOP_API_KEY is not set in environment variables');
  }
  return apiKey;
}

/**
 * Get Whop Webhook Secret from environment
 */
export function getWhopWebhookSecret(): string {
  const secret = process.env.WHOP_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('WHOP_WEBHOOK_SECRET is not set in environment variables');
  }
  return secret;
}

/**
 * Create a checkout session for the Basic plan
 */
export async function createBasicPlanCheckout(userId: string, email: string): Promise<{ url: string }> {
  const apiKey = getWhopApiKey();

  const requestBody = {
    product_id: WHOP_PRODUCTS.BASIC_PLAN,
    customer_email: email,
    metadata: {
      userId,
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/billing?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/billing?canceled=true`,
  };

  console.log('[Whop] Creating checkout session for Basic plan:', {
    product_id: requestBody.product_id,
    customer_email: requestBody.customer_email,
    userId: requestBody.metadata.userId,
    success_url: requestBody.success_url,
  });

  const response = await fetch('https://api.whop.com/api/v2/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Whop] Checkout session failed:', {
      status: response.status,
      statusText: response.statusText,
      error: errorText,
    });
    throw new Error(`Whop API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  console.log('[Whop] Checkout session created successfully');
  return { url: data.checkout_url };
}

/**
 * Create a checkout session for credit purchase
 */
export async function createCreditCheckout(userId: string, email: string): Promise<{ url: string }> {
  const apiKey = getWhopApiKey();

  const response = await fetch('https://api.whop.com/api/v2/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      product_id: WHOP_PRODUCTS.CREDIT_PACK,
      customer_email: email,
      metadata: {
        userId,
        type: 'credit_purchase',
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/billing?credits=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/billing?canceled=true`,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create credit checkout session: ${error}`);
  }

  const data = await response.json();
  return { url: data.checkout_url };
}

/**
 * Verify Whop webhook signature
 */
export function verifyWhopWebhook(payload: string, signature: string): boolean {
  const secret = getWhopWebhookSecret();

  // Whop uses HMAC-SHA256 for webhook signatures
  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return signature === expectedSignature;
}

/**
 * Calculate the next parse reset date (one month from given date)
 */
export function calculateNextResetDate(from: Date = new Date()): Date {
  const nextReset = new Date(from);
  nextReset.setMonth(nextReset.getMonth() + 1);
  return nextReset;
}

/**
 * Check if parse reset is due and return new values if needed
 */
export function checkParseReset(parseResetDate: Date | null): {
  needsReset: boolean;
  newResetDate: Date | null;
} {
  if (!parseResetDate) {
    return { needsReset: true, newResetDate: calculateNextResetDate() };
  }

  const now = new Date();
  const needsReset = now >= parseResetDate;

  return {
    needsReset,
    newResetDate: needsReset ? calculateNextResetDate() : null,
  };
}
