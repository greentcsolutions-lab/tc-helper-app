// src/app/api/gmail/status/route.ts
// Gmail connection status and settings API

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/prisma';
import { isGmailConnected } from '@/lib/gmail/client';

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

    // Check plan access
    if (user.planType !== 'DEV') {
      return NextResponse.json({
        connected: false,
        hasAccess: false,
        message: 'This feature is only available to DEV plan users',
      });
    }

    const connected = await isGmailConnected(user.id);

    if (!connected) {
      return NextResponse.json({
        connected: false,
        hasAccess: true,
      });
    }

    // Get Gmail settings
    const settings = await db.gmailSettings.findUnique({
      where: { userId: user.id },
      select: {
        primaryEmailAddress: true,
        useCustomSignature: true,
        customSignature: true,
        lastSyncStatus: true,
        lastSyncError: true,
        lastSyncedAt: true,
        webhookExpiration: true,
      },
    });

    return NextResponse.json({
      connected: true,
      hasAccess: true,
      email: settings?.primaryEmailAddress,
      signature: {
        useCustom: settings?.useCustomSignature || false,
        content: settings?.customSignature || null,
      },
      sync: {
        status: settings?.lastSyncStatus,
        error: settings?.lastSyncError,
        lastSyncedAt: settings?.lastSyncedAt?.toISOString(),
        webhookExpiration: settings?.webhookExpiration?.toISOString(),
      },
    });
  } catch (error) {
    console.error('[Gmail Status] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Update signature settings
export async function PATCH(request: NextRequest) {
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
      select: { id: true, planType: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check plan access
    if (user.planType !== 'DEV') {
      return NextResponse.json(
        { error: 'This feature is only available to DEV plan users' },
        { status: 403 }
      );
    }

    const connected = await isGmailConnected(user.id);
    if (!connected) {
      return NextResponse.json(
        { error: 'Gmail not connected' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { useCustomSignature, customSignature } = body;

    await db.gmailSettings.update({
      where: { userId: user.id },
      data: {
        useCustomSignature: useCustomSignature ?? undefined,
        customSignature: customSignature ?? undefined,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Signature settings updated',
    });
  } catch (error) {
    console.error('[Gmail Status PATCH] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
