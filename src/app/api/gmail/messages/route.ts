// src/app/api/gmail/messages/route.ts
// Gmail messages/threads fetching API

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/prisma';
import { fetchThreads, fetchEmails } from '@/lib/gmail/messages';
import { isGmailConnected, refreshGmailAccessToken } from '@/lib/gmail/client';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow longer execution for fetching emails

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
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const maxResults = parseInt(searchParams.get('maxResults') || '50', 10);
    const pageToken = searchParams.get('pageToken') || undefined;
    const mode = searchParams.get('mode') || 'threads'; // 'threads' or 'messages'

    // Default to last 7 days
    const endDate = endDateStr ? new Date(endDateStr) : new Date();
    const startDate = startDateStr
      ? new Date(startDateStr)
      : new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Validate date range (max 30 days)
    const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 30) {
      return NextResponse.json(
        { error: 'Date range cannot exceed 30 days' },
        { status: 400 }
      );
    }

    try {
      if (mode === 'threads') {
        const result = await fetchThreads(user.id, {
          startDate,
          endDate,
          maxResults: Math.min(maxResults, 100),
          pageToken,
        });

        return NextResponse.json({
          threads: result.threads,
          nextPageToken: result.nextPageToken,
          dateRange: {
            start: startDate.toISOString(),
            end: endDate.toISOString(),
          },
        });
      } else {
        const result = await fetchEmails(user.id, {
          startDate,
          endDate,
          maxResults: Math.min(maxResults, 100),
          pageToken,
        });

        return NextResponse.json({
          messages: result.messages,
          nextPageToken: result.nextPageToken,
          dateRange: {
            start: startDate.toISOString(),
            end: endDate.toISOString(),
          },
        });
      }
    } catch (fetchError: unknown) {
      // Handle token expiration
      if (
        fetchError instanceof Error &&
        (fetchError.message.includes('invalid_grant') ||
          fetchError.message.includes('Token has been expired'))
      ) {
        // Try to refresh token
        const refreshed = await refreshGmailAccessToken(user.id);
        if (!refreshed) {
          return NextResponse.json(
            { error: 'Gmail session expired. Please reconnect.', code: 'TOKEN_EXPIRED' },
            { status: 401 }
          );
        }

        // Retry fetch after refresh
        if (mode === 'threads') {
          const result = await fetchThreads(user.id, {
            startDate,
            endDate,
            maxResults: Math.min(maxResults, 100),
            pageToken,
          });

          return NextResponse.json({
            threads: result.threads,
            nextPageToken: result.nextPageToken,
            dateRange: {
              start: startDate.toISOString(),
              end: endDate.toISOString(),
            },
          });
        } else {
          const result = await fetchEmails(user.id, {
            startDate,
            endDate,
            maxResults: Math.min(maxResults, 100),
            pageToken,
          });

          return NextResponse.json({
            messages: result.messages,
            nextPageToken: result.nextPageToken,
            dateRange: {
              start: startDate.toISOString(),
              end: endDate.toISOString(),
            },
          });
        }
      }

      throw fetchError;
    }
  } catch (error) {
    console.error('[Gmail Messages] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch emails' },
      { status: 500 }
    );
  }
}
