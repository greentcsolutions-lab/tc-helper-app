// src/app/api/gmail/send/route.ts
// Gmail send email API

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/prisma';
import { sendEmail, replyToThread } from '@/lib/gmail/send';
import { isGmailConnected } from '@/lib/gmail/client';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const sendEmailSchema = z.object({
  to: z.array(z.string().email()).min(1, 'At least one recipient required'),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
  subject: z.string().min(1, 'Subject is required'),
  bodyText: z.string().optional(),
  bodyHtml: z.string().optional(),
  threadId: z.string().optional(),
  inReplyTo: z.string().optional(),
  references: z.string().optional(),
  parseId: z.string().optional(), // Link to transaction
});

export async function POST(request: NextRequest) {
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

    // Parse and validate request body
    const body = await request.json();
    const validation = sendEmailSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Ensure at least body text or HTML is provided
    if (!data.bodyText && !data.bodyHtml) {
      return NextResponse.json(
        { error: 'Email body is required (text or HTML)' },
        { status: 400 }
      );
    }

    // Get metadata for audit trail
    const ipAddress = request.headers.get('x-forwarded-for') ||
                      request.headers.get('x-real-ip') ||
                      'unknown';
    const userAgent = request.headers.get('user-agent') || undefined;

    // Send the email
    const result = data.threadId
      ? await replyToThread(
          user.id,
          data.threadId,
          {
            to: data.to,
            cc: data.cc,
            bcc: data.bcc,
            subject: data.subject,
            bodyText: data.bodyText,
            bodyHtml: data.bodyHtml,
            inReplyTo: data.inReplyTo,
            references: data.references,
          },
          {
            parseId: data.parseId,
            ipAddress,
            userAgent,
          }
        )
      : await sendEmail(
          user.id,
          {
            to: data.to,
            cc: data.cc,
            bcc: data.bcc,
            subject: data.subject,
            bodyText: data.bodyText,
            bodyHtml: data.bodyHtml,
          },
          {
            parseId: data.parseId,
            ipAddress,
            userAgent,
          }
        );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to send email' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      threadId: result.threadId,
    });
  } catch (error) {
    console.error('[Gmail Send] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
