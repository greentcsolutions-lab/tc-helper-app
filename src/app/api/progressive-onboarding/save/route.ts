import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/prisma';
import { sendWelcomeEmail } from '@/lib/email/send-welcome-email';

const ALLOWED_FIELDS = ['name', 'phone', 'role', 'problems', 'referralSource', 'onboarded'] as const;

// Zod validation schema
const onboardingSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().max(20).optional(),
  role: z.string().max(50).optional(),
  problems: z.array(z.string()).optional(),
  referralSource: z.string().max(50).optional(),
  onboarded: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    // Validate input
    const parsed = onboardingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.format() }, { status: 400 });
    }

    // Extract the field being updated (should only be one)
    const updateData: any = {};

    for (const field of ALLOWED_FIELDS) {
      if (field in parsed.data) {
        updateData[field] = parsed.data[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // Fetch existing user to check onboarded state transition
    const existingUser = await db.user.findUnique({
      where: { clerkId: userId },
      select: { onboarded: true, email: true, name: true },
    });

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const previousOnboarded = existingUser.onboarded ?? false;

    // Update user in database
    await db.user.update({
      where: { clerkId: userId },
      data: updateData,
    });

    // Also update Clerk metadata if it's name
    if ('name' in updateData) {
      const client = await clerkClient();
      const [firstName, ...lastNameParts] = (updateData.name as string).split(' ');
      const lastName = lastNameParts.join(' ');

      await client.users.updateUser(userId, {
        firstName: firstName || '',
        lastName: lastName || '',
      });
    }

    // Send welcome email on onboarding completion (false → true transition)
    if (existingUser.email && previousOnboarded === false && updateData.onboarded === true) {
      const userName = updateData.name || existingUser.name || 'User';
      const [firstName] = userName.split(' ');

      // Fire-and-forget: don't block response
      sendWelcomeEmail({
        email: existingUser.email,
        firstName: firstName || 'User',
      }).catch((err) => {
        console.error('[progressive-onboarding/save] Failed to send welcome email:', err instanceof Error ? err.message : 'Unknown');
      });
    }

    console.log(`[progressive-onboarding/save] Updated fields for user ${userId}:`, Object.keys(updateData));

    // Return success without exposing full user object
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[progressive-onboarding/save] Error type:', error instanceof Error ? error.message : 'Unknown');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
