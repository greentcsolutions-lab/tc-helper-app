// src/app/api/gmail/disconnect/route.ts
// Gmail OAuth disconnection handler

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/prisma';
import { revokeGmailAccess } from '@/lib/gmail/client';
import { stopGmailWatch } from '@/lib/gmail/webhook';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await db.user.findUnique({
      where: { clerkId: clerkUserId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Stop Gmail watch first
    try {
      await stopGmailWatch(user.id);
    } catch (watchError) {
      console.error('[Gmail Disconnect] Error stopping watch:', watchError);
      // Continue with disconnection
    }

    // Revoke access and clear tokens
    const success = await revokeGmailAccess(user.id);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to disconnect Gmail' },
        { status: 500 }
      );
    }

    console.log('[Gmail Disconnect] Successfully disconnected Gmail for user:', user.id);

    return NextResponse.json({
      success: true,
      message: 'Gmail disconnected successfully. Cached emails have been cleared.',
    });
  } catch (error) {
    console.error('[Gmail Disconnect] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
