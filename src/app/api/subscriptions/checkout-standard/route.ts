/**
 * Create Whop Checkout Session for Standard Plan Subscription
 *
 * POST /api/subscriptions/checkout-standard
 * Body: { userId: string, email: string }
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/prisma';
import { createStandardPlanCheckout } from '@/lib/whop';

export async function POST() {
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

    // Check if user is already on Standard plan
    if (user.planType === 'STANDARD') {
      return NextResponse.json(
        { error: 'Already subscribed to Standard plan' },
        { status: 400 }
      );
    }

    // Create checkout session
    const checkout = await createStandardPlanCheckout(
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
