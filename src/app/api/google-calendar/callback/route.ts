// src/app/api/google-calendar/callback/route.ts
// OAuth callback handler for Google Calendar

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getTokensFromCode } from '@/lib/google-calendar/client';
import { initializeCalendars } from '@/lib/google-calendar/calendar-init';
import { setupWebhook } from '@/lib/google-calendar/webhook';
import { performInitialSync } from '@/lib/google-calendar/sync';
import { db as prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      console.error('OAuth error:', error);
      return NextResponse.redirect(
        new URL(`/settings?calendar_error=${encodeURIComponent(error)}`, request.url)
      );
    }

    if (!code) {
      return NextResponse.json({ error: 'No authorization code provided' }, { status: 400 });
    }

    // Exchange code for tokens
    const tokens = await getTokensFromCode(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      return NextResponse.redirect(
        new URL('/settings?calendar_error=Failed to obtain tokens', request.url)
      );
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Create or update calendar settings
    await prisma.calendarSettings.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        googleAccessToken: tokens.access_token,
        googleRefreshToken: tokens.refresh_token,
        googleTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        syncEnabled: true,
      },
      update: {
        googleAccessToken: tokens.access_token,
        googleRefreshToken: tokens.refresh_token,
        googleTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        syncEnabled: true,
      },
    });

    // Initialize calendars (create TC Helper calendars)
    const { primaryCalendarId, archivedCalendarId, error: calendarError } =
      await initializeCalendars(user.id);

    if (calendarError) {
      console.error('Error initializing calendars:', calendarError);
    }

    // Set up webhook for real-time sync
    if (primaryCalendarId) {
      await setupWebhook(user.id);
    }

    // Perform initial sync (push all tasks to calendar)
    if (primaryCalendarId) {
      await performInitialSync(user.id);
    }

    // Redirect back to settings with success
    return NextResponse.redirect(new URL('/settings?calendar_connected=true', request.url));
  } catch (error) {
    console.error('Error in OAuth callback:', error);
    return NextResponse.redirect(
      new URL(
        `/settings?calendar_error=${encodeURIComponent('Failed to connect calendar')}`,
        request.url
      )
    );
  }
}
