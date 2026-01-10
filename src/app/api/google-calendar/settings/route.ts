// src/app/api/google-calendar/settings/route.ts
// Get and update Google Calendar settings

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get calendar settings
    const settings = await prisma.calendarSettings.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        syncEnabled: true,
        includeFullDetails: true,
        syncNonAppEvents: true,
        excludeFinancialData: true,
        primaryCalendarId: true,
        archivedCalendarId: true,
        lastSyncAt: true,
        lastSyncError: true,
        initialSyncCompleted: true,
        webhookExpiration: true,
      },
    });

    // Return settings or defaults
    return NextResponse.json({
      settings: settings || {
        syncEnabled: false,
        includeFullDetails: true,
        syncNonAppEvents: true,
        excludeFinancialData: true,
        primaryCalendarId: null,
        archivedCalendarId: null,
        lastSyncAt: null,
        lastSyncError: null,
        initialSyncCompleted: false,
        webhookExpiration: null,
      },
      isConnected: !!settings?.primaryCalendarId,
    });
  } catch (error) {
    console.error('Error getting calendar settings:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { syncEnabled, includeFullDetails, syncNonAppEvents, excludeFinancialData } = body;

    // Update settings
    const settings = await prisma.calendarSettings.update({
      where: { userId: user.id },
      data: {
        syncEnabled: syncEnabled !== undefined ? syncEnabled : undefined,
        includeFullDetails: includeFullDetails !== undefined ? includeFullDetails : undefined,
        syncNonAppEvents: syncNonAppEvents !== undefined ? syncNonAppEvents : undefined,
        excludeFinancialData:
          excludeFinancialData !== undefined ? excludeFinancialData : undefined,
      },
    });

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Error updating calendar settings:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
