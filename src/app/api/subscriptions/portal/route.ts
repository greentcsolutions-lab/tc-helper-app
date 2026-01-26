/**
 * Get Whop Customer Portal URL
 *
 * GET /api/subscriptions/portal
 * Returns the manage_url for subscription management
 * - Paid users: Whop billing portal to manage/cancel
 * - Free users: Plans page to upgrade
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

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Free users → redirect to plans page to upgrade
    if (user.planType === 'FREE' || !user.stripeCustomerId) {
      return NextResponse.json({
        url: `${appUrl}/plans`,
        status: 'free',
        cancelAtPeriodEnd: false,
        renewalPeriodEnd: null,
      });
    }

    // Paid users → fetch Whop billing portal URL
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
      // Fallback to plans page if Whop API fails
      return NextResponse.json({
        url: `${appUrl}/plans`,
        status: 'error',
        cancelAtPeriodEnd: false,
        renewalPeriodEnd: null,
      });
    }

    const membership = await response.json();

    // Fallback if manage_url not available
    if (!membership.manage_url) {
      return NextResponse.json({
        url: `${appUrl}/plans`,
        status: membership.status || 'unknown',
        cancelAtPeriodEnd: false,
        renewalPeriodEnd: null,
      });
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
