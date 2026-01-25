/**
 * Whop Webhook Handler
 *
 * Handles subscription and payment events from Whop:
 * - membership.went_valid: Activate subscription
 * - membership.went_invalid: Deactivate subscription
 * - payment.succeeded: Process one-time credit purchases
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/prisma';
import {
  verifyWhopWebhook,
  PLAN_CONFIGS,
  calculateNextResetDate,
  WHOP_PRODUCTS,
} from '@/lib/whop';

export async function POST(req: NextRequest) {
  try {
    // Get the raw body for signature verification
    const body = await req.text();
    const signature = req.headers.get('x-whop-signature') || '';

    // Verify webhook signature
    if (!verifyWhopWebhook(body, signature)) {
      console.error('Invalid webhook signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Parse the webhook payload
    const event = JSON.parse(body);
    console.log('Received Whop webhook:', event.type);

    // Handle different event types
    switch (event.type) {
      case 'membership.went_valid':
        await handleMembershipActivated(event.data);
        break;

      case 'membership.went_invalid':
        await handleMembershipDeactivated(event.data);
        break;

      case 'payment.succeeded':
        await handlePaymentSucceeded(event.data);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

/**
 * Handle membership activation (subscription started)
 */
async function handleMembershipActivated(data: any) {
  const { id: membershipId, product, user, metadata } = data;
  const userId = metadata?.userId || user?.id;

  if (!userId) {
    console.error('No userId found in membership data');
    return;
  }

  // Determine which plan based on product ID
  const productId = product?.id;
  let planType: 'BASIC' | 'STANDARD' | null = null;
  let planConfig;

  if (productId === WHOP_PRODUCTS.BASIC_PLAN) {
    planType = 'BASIC';
    planConfig = PLAN_CONFIGS.BASIC;
  } else if (productId === WHOP_PRODUCTS.STANDARD_PLAN) {
    planType = 'STANDARD';
    planConfig = PLAN_CONFIGS.STANDARD;
  } else {
    console.log('Not a recognized plan subscription, skipping');
    return;
  }

  console.log(`Activating ${planType} plan for user ${userId}`);

  // Update user with plan
  await db.user.update({
    where: { id: userId },
    data: {
      planType,
      quota: planConfig.quota,
      parseLimit: planConfig.parseLimit,
      parseCount: 0, // Reset count on subscription
      parseResetDate: calculateNextResetDate(),
      stripeCustomerId: membershipId, // Store Whop membership ID
      stripeSubscriptionId: product?.id,
      priceId: data.plan_id || planType.toLowerCase(), // Store plan variant (monthly/annual)
      currentPeriodEnd: data.expires_at ? new Date(data.expires_at) : null,
    },
  });

  console.log(`Successfully activated ${planType} plan for user ${userId}`);
}

/**
 * Handle membership deactivation (subscription cancelled/expired)
 */
async function handleMembershipDeactivated(data: any) {
  const { id: membershipId, metadata, user } = data;
  const userId = metadata?.userId || user?.id;

  if (!userId) {
    console.error('No userId found in membership data');
    return;
  }

  console.log(`Deactivating subscription for user ${userId}`);

  // Get free plan configuration
  const freePlanConfig = PLAN_CONFIGS.FREE;

  // Downgrade user to free tier
  await db.user.update({
    where: { id: userId },
    data: {
      planType: 'FREE',
      quota: freePlanConfig.quota,
      parseLimit: freePlanConfig.parseLimit,
      parseCount: 0,
      parseResetDate: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      priceId: null,
      currentPeriodEnd: null,
    },
  });

  console.log(`Successfully downgraded user ${userId} to free tier`);
}

/**
 * Handle successful payment (for one-time credit purchases)
 */
async function handlePaymentSucceeded(data: any) {
  const { product, metadata, user } = data;
  const userId = metadata?.userId || user?.id;

  if (!userId) {
    console.error('No userId found in payment data');
    return;
  }

  // Check if this is a credit purchase
  if (product?.id !== WHOP_PRODUCTS.CREDIT_PACK) {
    console.log('Not a credit purchase, skipping');
    return;
  }

  console.log(`Processing credit purchase for user ${userId}`);

  // Add 5 credits to user's account
  await db.user.update({
    where: { id: userId },
    data: {
      credits: {
        increment: 5,
      },
    },
  });

  console.log(`Successfully added 5 credits for user ${userId}`);
}
