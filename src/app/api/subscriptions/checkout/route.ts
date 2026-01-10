/**
 * Create Whop Checkout Session for Basic Plan Subscription
 *
 * POST /api/subscriptions/checkout
 * Body: { userId: string, email: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/prisma';
import { createBasicPlanCheckout } from '@/lib/whop';

export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user from database
    const user = await db.user.findUnique({
      where: { clerkId },
      select: { id: true, email: true, planType: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user is already on Basic plan
    if (user.planType === 'BASIC') {
      return NextResponse.json(
        { error: 'Already subscribed to Basic plan' },
        { status: 400 }
      );
    }

    // Create checkout session
    const checkout = await createBasicPlanCheckout(
      user.id,
      user.email || ''
    );

    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    console.error('Checkout error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create checkout session';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
