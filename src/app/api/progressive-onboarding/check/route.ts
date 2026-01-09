import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/prisma';

const ONBOARDING_FIELDS = ['name', 'phone', 'role', 'problems', 'referralSource'] as const;

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ shouldShow: false, missingFields: [] });
    }

    // Get user from database
    let user;
    try {
      user = await db.user.findUnique({
        where: { clerkId: userId },
        select: {
          name: true,
          phone: true,
          role: true,
          problems: true,
          referralSource: true,
          onboarded: true,
          onboardingOptedOut: true,
          onboardingDismissedCount: true,
          lastOnboardingPrompt: true,
        },
      });
    } catch (dbError: any) {
      console.error('[progressive-onboarding/check] Database error (migrations not run?):', dbError.message);
      return NextResponse.json({ shouldShow: false, missingFields: [] });
    }

    if (!user) {
      return NextResponse.json({ shouldShow: false, missingFields: [] });
    }

    // Don't show if user hasn't completed main onboarding yet
    if (!user.onboarded) {
      return NextResponse.json({ shouldShow: false, missingFields: [] });
    }

    // Don't show if user opted out
    if (user.onboardingOptedOut) {
      return NextResponse.json({ shouldShow: false, missingFields: [] });
    }

    // Check if they dismissed recently - wait 3 sessions before showing again
    // A "session" is defined as each time we would show the modal
    // So if dismissedCount >= 3, we can show again (reset counter)
    if (user.onboardingDismissedCount > 0 && user.onboardingDismissedCount < 3) {
      return NextResponse.json({ shouldShow: false, missingFields: [] });
    }

    // Find missing fields
    const missingFields: string[] = [];

    for (const field of ONBOARDING_FIELDS) {
      const value = user[field];

      // Check if field is missing
      if (field === 'problems') {
        // problems is an array - check if empty
        if (!value || (Array.isArray(value) && value.length === 0)) {
          missingFields.push(field);
        }
      } else {
        // Other fields are strings or null
        if (!value || value === '') {
          missingFields.push(field);
        }
      }
    }

    // Reset dismiss counter if we're showing the modal again
    if (missingFields.length > 0 && user.onboardingDismissedCount >= 3) {
      await db.user.update({
        where: { clerkId: userId },
        data: { onboardingDismissedCount: 0 },
      });
    }

    return NextResponse.json({
      shouldShow: missingFields.length > 0,
      missingFields,
    });
  } catch (error) {
    console.error('[progressive-onboarding/check] Error:', error);
    return NextResponse.json({ shouldShow: false, missingFields: [] });
  }
}
