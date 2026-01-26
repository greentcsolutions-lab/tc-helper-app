// src/app/api/gmail/callback/route.ts
// Gmail OAuth callback handler

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/prisma';
import {
  getTokensFromCode,
  createOAuth2Client,
  ensureTcHelperLabel,
  GMAIL_SCOPES,
} from '@/lib/gmail/client';
import { google } from 'googleapis';
import { setupGmailWatch } from '@/lib/gmail/webhook';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth();
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // Contains our user ID
    const error = searchParams.get('error');

    // Handle OAuth errors
    if (error) {
      console.error('[Gmail Callback] OAuth error:', error);
      return NextResponse.redirect(
        new URL('/comms?error=oauth_denied', request.url)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/comms?error=no_code', request.url)
      );
    }

    if (!clerkUserId) {
      return NextResponse.redirect(
        new URL('/sign-in?redirect_url=/comms', request.url)
      );
    }

    // Verify user
    const user = await db.user.findUnique({
      where: { clerkId: clerkUserId },
      select: { id: true, planType: true },
    });

    if (!user) {
      return NextResponse.redirect(
        new URL('/comms?error=user_not_found', request.url)
      );
    }

    // Verify state matches user ID (CSRF protection)
    if (state && state !== user.id) {
      console.error('[Gmail Callback] State mismatch:', { state, userId: user.id });
      return NextResponse.redirect(
        new URL('/comms?error=state_mismatch', request.url)
      );
    }

    // Exchange code for tokens
    const tokens = await getTokensFromCode(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      console.error('[Gmail Callback] Missing tokens');
      return NextResponse.redirect(
        new URL('/comms?error=missing_tokens', request.url)
      );
    }

    // Set up client to get user's email address
    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials(tokens);

    // Get user's Gmail address
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: 'me' });
    const emailAddress = profile.data.emailAddress;

    // Create or find TC Helper label
    const labelId = await ensureTcHelperLabel(gmail);

    // Upsert Gmail settings
    await db.gmailSettings.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        googleAccessToken: tokens.access_token,
        googleRefreshToken: tokens.refresh_token,
        googleTokenExpiry: tokens.expiry_date
          ? new Date(tokens.expiry_date)
          : null,
        primaryEmailAddress: emailAddress,
        tcHelperLabelId: labelId,
        disconnectedAt: null,
      },
      update: {
        googleAccessToken: tokens.access_token,
        googleRefreshToken: tokens.refresh_token,
        googleTokenExpiry: tokens.expiry_date
          ? new Date(tokens.expiry_date)
          : null,
        primaryEmailAddress: emailAddress,
        tcHelperLabelId: labelId,
        disconnectedAt: null,
        lastSyncStatus: null,
        lastSyncError: null,
      },
    });

    // Set up Gmail push notifications (watch)
    // Note: This requires Pub/Sub to be configured
    try {
      await setupGmailWatch(user.id);
    } catch (watchError) {
      console.error('[Gmail Callback] Error setting up watch:', watchError);
      // Non-fatal, user can still use manual refresh
    }

    console.log('[Gmail Callback] Successfully connected Gmail for user:', user.id);

    return NextResponse.redirect(
      new URL('/comms?success=connected', request.url)
    );
  } catch (error) {
    console.error('[Gmail Callback] Error:', error);
    return NextResponse.redirect(
      new URL('/comms?error=callback_failed', request.url)
    );
  }
}
