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
  BASIC_MONTHLY: 'plan_jiXiD1lGMTEy6',   // $15/month Basic plan
  BASIC_YEARLY: 'plan_z80DjYcElspeg',    // $150/year Basic plan
  STANDARD_MONTHLY: 'plan_3JSwKKwDFDnXv', // $50/month Standard plan
  STANDARD_YEARLY: 'plan_C8psS1XZsT7hd',  // $500/year Standard plan
  CREDIT_PACK: 'plan_aNk5dVMU4VTtf',     // $10 for 5 credits
} as const;

// Legacy naming for backwards compatibility (defaults to monthly)
export const WHOP_PRODUCTS = {
  BASIC_PLAN: WHOP_PLANS.BASIC_MONTHLY,
  STANDARD_PLAN: WHOP_PLANS.STANDARD_MONTHLY,
  CREDIT_PACK: WHOP_PLANS.CREDIT_PACK,
} as const;

// Plan Types
export type PlanType = 'FREE' | 'BASIC' | 'STANDARD';

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
      monthly: 15,
      annual: 150,
    },
  },
  STANDARD: {
    name: 'Standard',
    quota: 200,            // 200 concurrent transactions
    parseLimit: 50,        // 50 AI parses per month (resets monthly)
    customTaskLimit: 999999, // Unlimited custom tasks
    templateLimit: 50,     // 50 task templates
    price: {
      monthly: 50,
      annual: 500,
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
 * Create a checkout session for the Standard plan
 * Uses direct Whop checkout URLs (no API call needed)
 */
export async function createStandardPlanCheckout(userId: string, email: string): Promise<{ url: string }> {
  const planId = WHOP_PRODUCTS.STANDARD_PLAN; // Defaults to monthly plan

  console.log('[Whop] Creating checkout URL for Standard plan:', {
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

/**
 * Retrieve membership details from Whop API
 * Returns manage_url and subscription details
 */
export async function getWhopMembership(membershipId: string): Promise<{
  manage_url: string;
  status: string;
  valid: boolean;
  cancel_at_period_end: boolean;
  renewal_period_start: number;
  renewal_period_end: number;
  plan_id: string;
  product_id: string;
} | null> {
  try {
    const apiKey = getWhopApiKey();
    const response = await fetch(`https://api.whop.com/api/v2/memberships/${membershipId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('[Whop] Failed to retrieve membership:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    console.log('[Whop] Retrieved membership:', {
      id: membershipId,
      status: data.status,
      manage_url: data.manage_url,
    });

    return {
      manage_url: data.manage_url,
      status: data.status,
      valid: data.valid,
      cancel_at_period_end: data.cancel_at_period_end,
      renewal_period_start: data.renewal_period_start,
      renewal_period_end: data.renewal_period_end,
      plan_id: data.plan,
      product_id: data.product,
    };
  } catch (error) {
    console.error('[Whop] Error retrieving membership:', error);
    return null;
  }
}
