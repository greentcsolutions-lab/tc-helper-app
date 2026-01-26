// src/app/api/gmail/attachments/route.ts
// Gmail attachment download API

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/prisma';
import { downloadAttachment } from '@/lib/gmail/messages';
import { isGmailConnected } from '@/lib/gmail/client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
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

    // Check if Gmail is connected
    const connected = await isGmailConnected(user.id);
    if (!connected) {
      return NextResponse.json(
        { error: 'Gmail not connected', code: 'NOT_CONNECTED' },
        { status: 400 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const messageId = searchParams.get('messageId');
    const attachmentId = searchParams.get('attachmentId');

    if (!messageId || !attachmentId) {
      return NextResponse.json(
        { error: 'Missing messageId or attachmentId' },
        { status: 400 }
      );
    }

    // Download attachment
    const attachment = await downloadAttachment(user.id, messageId, attachmentId);

    if (!attachment) {
      return NextResponse.json(
        { error: 'Attachment not found' },
        { status: 404 }
      );
    }

    // Return file as download
    // Convert Buffer to Uint8Array for NextResponse compatibility
    const uint8Array = new Uint8Array(attachment.data);
    return new NextResponse(uint8Array, {
      headers: {
        'Content-Type': attachment.mimeType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(attachment.filename)}"`,
        'Content-Length': attachment.data.length.toString(),
      },
    });
  } catch (error) {
    console.error('[Gmail Attachments] Error:', error);
    return NextResponse.json(
      { error: 'Failed to download attachment' },
      { status: 500 }
    );
  }
}
