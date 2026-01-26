// src/app/api/gmail/connect/route.ts
// Gmail OAuth connection initiation

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/prisma';
import { getGmailAuthUrl } from '@/lib/gmail/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user and check plan
    const user = await db.user.findUnique({
      where: { clerkId: clerkUserId },
      select: { id: true, planType: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user has DEV plan (feature gating)
    if (user.planType !== 'DEV') {
      return NextResponse.json(
        { error: 'This feature is only available to DEV plan users' },
        { status: 403 }
      );
    }

    // Generate OAuth URL with user ID as state
    const authUrl = getGmailAuthUrl(user.id);

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('[Gmail Connect] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
