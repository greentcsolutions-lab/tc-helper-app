/**
 * Create Whop Checkout Session for Credit Purchase
 *
 * POST /api/subscriptions/buy-credits
 * Purchases 5 additional AI parse credits for $10 (one-time payment)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { createCreditCheckout } from '@/lib/whop';

export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true, email: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Create checkout session for credit purchase
    const checkout = await createCreditCheckout(
      user.id,
      user.email || ''
    );

    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    console.error('Credit checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
