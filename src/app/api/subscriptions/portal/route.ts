/**
 * Get Whop Customer Portal URL
 *
 * GET /api/subscriptions/portal
 * Returns the manage_url for the user's active subscription
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/prisma';
import { getWhopApiKey } from '@/lib/whop';

export async function GET() {
  try {
    // Authenticate user
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user from database
    const user = await db.user.findUnique({
      where: { clerkId },
      select: {
        id: true,
        planType: true,
        stripeCustomerId: true, // This stores the Whop membership ID
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Free users don't have a subscription to manage
    if (user.planType === 'FREE') {
      return NextResponse.json(
        { error: 'No active subscription' },
        { status: 400 }
      );
    }

    // Need membership ID to get portal URL
    if (!user.stripeCustomerId) {
      return NextResponse.json(
        { error: 'Subscription data not found' },
        { status: 400 }
      );
    }

    // Fetch membership details from Whop API
    const apiKey = getWhopApiKey();
    const response = await fetch(
      `https://api.whop.com/api/v5/company/memberships/${user.stripeCustomerId}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error('Whop API error:', response.status, await response.text());
      return NextResponse.json(
        { error: 'Failed to retrieve subscription details' },
        { status: 500 }
      );
    }

    const membership = await response.json();

    if (!membership.manage_url) {
      return NextResponse.json(
        { error: 'Portal URL not available' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      url: membership.manage_url,
      status: membership.status,
      cancelAtPeriodEnd: membership.cancel_at_period_end || false,
      renewalPeriodEnd: membership.renewal_period_end
        ? new Date(membership.renewal_period_end * 1000).toISOString()
        : null,
    });
  } catch (error) {
    console.error('Portal URL error:', error);
    return NextResponse.json(
      { error: 'Failed to get portal URL' },
      { status: 500 }
    );
  }
}
