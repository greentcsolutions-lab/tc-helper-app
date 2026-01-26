/**
 * Whop Integration
 *
 * This module handles all Whop-related functionality including:
 * - Checkout session creation for subscriptions and one-time purchases
 * - Webhook signature verification
 * - Plan management and user updates
 */

// Whop Plan IDs - Direct from Whop dashboard
export const WHOP_PLANS = {
  BASIC_MONTHLY: 'plan_jiXiD1lGMTEy6',   // $20/month Basic plan
  BASIC_YEARLY: 'plan_z80DjYcElspeg',    // $200/year Basic plan
  CREDIT_PACK: 'plan_aNk5dVMU4VTtf',     // $10 for 5 credits
} as const;

// Legacy naming for backwards compatibility (defaults to monthly)
export const WHOP_PRODUCTS = {
  BASIC_PLAN: WHOP_PLANS.BASIC_MONTHLY,
  CREDIT_PACK: WHOP_PLANS.CREDIT_PACK,
} as const;

// Plan Types
export type PlanType = 'FREE' | 'BASIC';

// Plan Configuration
export interface PlanConfig {
  name: string;
  quota: number;           // Concurrent active transactions
  parseLimit: number;      // AI parses (FREE: total, BASIC: per month)
  customTaskLimit: number; // Custom tasks limit
  templateLimit: number;   // Task templates limit
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
    customTaskLimit: 10,   // 10 custom tasks
    templateLimit: 1,      // 1 task template
    price: {
      monthly: 0,
      annual: 0,
    },
  },
  BASIC: {
    name: 'Basic',
    quota: 20,             // 20 concurrent transactions
    parseLimit: 5,         // 5 AI parses per month (resets monthly)
    customTaskLimit: 100,  // 100 custom tasks
    templateLimit: 10,     // 10 task templates
    price: {
      monthly: 20,
      annual: 200,
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
 * Uses direct Whop checkout URLs (no API call needed)
 */
export async function createBasicPlanCheckout(userId: string, email: string): Promise<{ url: string }> {
  const planId = WHOP_PRODUCTS.BASIC_PLAN; // Defaults to monthly plan

  console.log('[Whop] Creating checkout URL for Basic plan:', {
    plan_id: planId,
    userId,
  });

  // Build direct checkout URL with metadata
  const redirectUrl = encodeURIComponent(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/billing?success=true`);
  const checkoutUrl = `https://whop.com/checkout/${planId}?redirect_url=${redirectUrl}&d[userId]=${userId}&d[email]=${email}`;

  console.log('[Whop] Checkout URL created:', {
    plan_id: planId,
    checkout_url: checkoutUrl,
  });

  return { url: checkoutUrl };
}

/**
 * Create a checkout session for credit purchase
 * Uses direct Whop checkout URLs (no API call needed)
 */
export async function createCreditCheckout(userId: string, email: string): Promise<{ url: string }> {
  const planId = WHOP_PRODUCTS.CREDIT_PACK;

  console.log('[Whop] Creating checkout URL for credit pack:', {
    plan_id: planId,
    userId,
  });

  // Build direct checkout URL with metadata
  const redirectUrl = encodeURIComponent(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/billing?credits=true`);
  const checkoutUrl = `https://whop.com/checkout/${planId}?redirect_url=${redirectUrl}&d[userId]=${userId}&d[email]=${email}&d[type]=credit_purchase`;

  console.log('[Whop] Checkout URL created:', {
    plan_id: planId,
    checkout_url: checkoutUrl,
  });

  return { url: checkoutUrl };
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
