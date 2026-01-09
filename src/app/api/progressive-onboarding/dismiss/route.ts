import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action } = await req.json();

    if (action === 'not_now') {
      // Increment dismiss counter
      await db.user.update({
        where: { clerkId: userId },
        data: {
          onboardingDismissedCount: { increment: 1 },
          lastOnboardingPrompt: new Date(),
        },
      });

      return NextResponse.json({ success: true, message: 'Dismissed for now' });
    } else if (action === 'opt_out') {
      // User opted out - never show again
      await db.user.update({
        where: { clerkId: userId },
        data: {
          onboardingOptedOut: true,
          lastOnboardingPrompt: new Date(),
        },
      });

      return NextResponse.json({ success: true, message: 'Opted out successfully' });
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[progressive-onboarding/dismiss] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
