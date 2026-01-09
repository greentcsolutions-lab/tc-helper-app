import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const ALLOWED_FIELDS = ['name', 'phone', 'role', 'problems', 'referralSource'] as const;

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    // Extract the field being updated (should only be one)
    const updateData: any = {};

    for (const field of ALLOWED_FIELDS) {
      if (field in body) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // Update user in database
    const updatedUser = await db.user.update({
      where: { clerkId: userId },
      data: updateData,
    });

    // Also update Clerk metadata if it's name or email
    if ('name' in updateData) {
      const client = await clerkClient();
      const [firstName, ...lastNameParts] = (updateData.name as string).split(' ');
      const lastName = lastNameParts.join(' ');

      await client.users.updateUser(userId, {
        firstName: firstName || '',
        lastName: lastName || '',
      });
    }

    console.log(`[progressive-onboarding/save] Updated fields for user ${userId}:`, Object.keys(updateData));

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error('[progressive-onboarding/save] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
