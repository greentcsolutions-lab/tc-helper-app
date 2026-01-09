/**
 * Whop Integration
 *
 * This module handles all Whop-related functionality including:
 * - Checkout session creation for subscriptions and one-time purchases
 * - Webhook signature verification
 * - Plan management and user updates
 */

// Whop Plan IDs (NOT Product IDs - plans define pricing for products)
export const WHOP_PLANS = {
  BASIC_PLAN: 'plan_qBP7zVT60nXmZ',      // $15/mo or $150/yr (UPDATE with your actual plan ID)
  CREDIT_PACK: 'plan_NolysBAikHLtP',     // $10 for 5 credits (UPDATE with your actual plan ID)
} as const;

// Legacy naming for backwards compatibility
export const WHOP_PRODUCTS = WHOP_PLANS;

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
    plan_id: WHOP_PLANS.BASIC_PLAN,
    redirect_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/billing?success=true`,
    metadata: {
      userId,
      email,
    },
  };

  console.log('[Whop] Creating checkout configuration for Basic plan:', {
    plan_id: requestBody.plan_id,
    redirect_url: requestBody.redirect_url,
    userId: requestBody.metadata.userId,
    apiKeyPrefix: apiKey.substring(0, 15) + '...',
  });

  // Use V1 API with checkout configurations (V2 and V5 are deprecated)
  const response = await fetch('https://api.whop.com/api/v1/checkout_configurations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Whop] Checkout configuration failed:', {
      status: response.status,
      statusText: response.statusText,
      error: errorText,
      endpoint: 'https://api.whop.com/api/v1/checkout_configurations',
    });
    throw new Error(`Whop API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  console.log('[Whop] Checkout configuration created successfully:', {
    config_id: data.id,
    purchase_url: data.purchase_url,
  });
  return { url: data.purchase_url };
}

/**
 * Create a checkout session for credit purchase
 */
export async function createCreditCheckout(userId: string, email: string): Promise<{ url: string }> {
  const apiKey = getWhopApiKey();

  const requestBody = {
    plan_id: WHOP_PLANS.CREDIT_PACK,
    redirect_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/billing?credits=true`,
    metadata: {
      userId,
      email,
      type: 'credit_purchase',
    },
  };

  console.log('[Whop] Creating checkout configuration for credit pack:', {
    plan_id: requestBody.plan_id,
    redirect_url: requestBody.redirect_url,
    userId: requestBody.metadata.userId,
  });

  // Use V1 API with checkout configurations (V2 and V5 are deprecated)
  const response = await fetch('https://api.whop.com/api/v1/checkout_configurations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Whop] Credit checkout configuration failed:', {
      status: response.status,
      statusText: response.statusText,
      error: errorText,
      endpoint: 'https://api.whop.com/api/v1/checkout_configurations',
    });
    throw new Error(`Whop API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  console.log('[Whop] Credit checkout configuration created successfully');
  return { url: data.purchase_url };
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
