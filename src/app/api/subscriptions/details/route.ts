/**
 * Get Subscription Details
 *
 * GET /api/subscriptions/details
 * Returns subscription details including manage_url from Whop
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/prisma';
import { getWhopMembership, PLAN_CONFIGS } from '@/lib/whop';

export async function GET() {
  try {
    // Authenticate user
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user from database with subscription details
    const user = await db.user.findUnique({
      where: { clerkId },
      select: {
        id: true,
        email: true,
        planType: true,
        stripeCustomerId: true, // Whop membership ID
        stripeSubscriptionId: true, // Whop product ID
        priceId: true, // Whop plan ID
        currentPeriodEnd: true,
        parseResetDate: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // If user has no subscription (FREE plan), return basic info
    if (user.planType === 'FREE' || !user.stripeCustomerId) {
      const planConfig = PLAN_CONFIGS.FREE;
      return NextResponse.json({
        planType: 'FREE',
        planName: planConfig.name,
        price: 0,
        billingCycle: null,
        nextBillingDate: null,
        cancelAtPeriodEnd: false,
        manageUrl: null,
        status: 'active',
      });
    }

    // Fetch subscription details from Whop
    const membership = await getWhopMembership(user.stripeCustomerId);

    if (!membership) {
      // If we can't fetch from Whop, return database info
      const planConfig = PLAN_CONFIGS[user.planType as 'BASIC' | 'STANDARD'];
      return NextResponse.json({
        planType: user.planType,
        planName: planConfig.name,
        price: planConfig.price.monthly,
        billingCycle: 'monthly',
        nextBillingDate: user.currentPeriodEnd,
        cancelAtPeriodEnd: false,
        manageUrl: null,
        status: 'active',
      });
    }

    // Determine billing cycle and price from plan ID
    const planConfig = PLAN_CONFIGS[user.planType as 'BASIC' | 'STANDARD'];
    const isAnnual = membership.plan_id.includes('YEARLY') ||
                     membership.plan_id === 'plan_z80DjYcElspeg' || // Basic annual
                     membership.plan_id === 'plan_C8psS1XZsT7hd';   // Standard annual

    const billingCycle = isAnnual ? 'annual' : 'monthly';
    const price = isAnnual ? planConfig.price.annual : planConfig.price.monthly;

    return NextResponse.json({
      planType: user.planType,
      planName: planConfig.name,
      price,
      billingCycle,
      nextBillingDate: new Date(membership.renewal_period_end * 1000).toISOString(),
      cancelAtPeriodEnd: membership.cancel_at_period_end,
      manageUrl: membership.manage_url,
      status: membership.status,
      valid: membership.valid,
    });
  } catch (error) {
    console.error('Subscription details error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch subscription details';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
