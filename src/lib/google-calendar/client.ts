// src/lib/google-calendar/client.ts
// Google Calendar API client wrapper

import { google, calendar_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { db as prisma } from '@/lib/prisma';

/**
 * Creates and configures a Google Calendar client for a user
 */
export async function getGoogleCalendarClient(userId: string): Promise<calendar_v3.Calendar | null> {
  try {
    // Fetch user's calendar settings
    const settings = await prisma.calendarSettings.findUnique({
      where: { userId },
    });

    if (!settings || !settings.googleAccessToken || !settings.googleRefreshToken) {
      return null;
    }

    // Create OAuth2 client
    const oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    // Set credentials
    oauth2Client.setCredentials({
      access_token: settings.googleAccessToken,
      refresh_token: settings.googleRefreshToken,
      expiry_date: settings.googleTokenExpiry?.getTime(),
    });

    // Set up token refresh handler
    oauth2Client.on('tokens', async (tokens) => {
      if (tokens.access_token) {
        await prisma.calendarSettings.update({
          where: { userId },
          data: {
            googleAccessToken: tokens.access_token,
            googleTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
          },
        });
      }
    });

    // Create and return calendar client
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    return calendar;
  } catch (error) {
    console.error('Error creating Google Calendar client:', error);
    return null;
  }
}

/**
 * Initializes OAuth2 client for authorization flow
 */
export function getOAuth2Client(): OAuth2Client {
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

/**
 * Generates the Google OAuth consent URL
 */
export function getAuthUrl(): string {
  const oauth2Client = getOAuth2Client();

  const scopes = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
  ];

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent', // Force consent to get refresh token
  });
}

/**
 * Exchanges authorization code for tokens
 */
export async function getTokensFromCode(code: string) {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

/**
 * Refreshes access token using refresh token
 */
export async function refreshAccessToken(userId: string): Promise<boolean> {
  try {
    const settings = await prisma.calendarSettings.findUnique({
      where: { userId },
    });

    if (!settings || !settings.googleRefreshToken) {
      return false;
    }

    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({
      refresh_token: settings.googleRefreshToken,
    });

    const { credentials } = await oauth2Client.refreshAccessToken();

    await prisma.calendarSettings.update({
      where: { userId },
      data: {
        googleAccessToken: credentials.access_token || null,
        googleTokenExpiry: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
      },
    });

    return true;
  } catch (error) {
    console.error('Error refreshing access token:', error);
    return false;
  }
}

/**
 * Revokes Google Calendar access and cleans up tokens
 */
export async function revokeAccess(userId: string): Promise<boolean> {
  try {
    const settings = await prisma.calendarSettings.findUnique({
      where: { userId },
    });

    if (!settings || !settings.googleAccessToken) {
      return true; // Already disconnected
    }

    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({
      access_token: settings.googleAccessToken,
    });

    // Revoke token with Google
    try {
      await oauth2Client.revokeCredentials();
    } catch (error) {
      console.error('Error revoking credentials with Google:', error);
      // Continue anyway to clean up our database
    }

    // Clear tokens from database
    await prisma.calendarSettings.update({
      where: { userId },
      data: {
        googleAccessToken: null,
        googleRefreshToken: null,
        googleTokenExpiry: null,
        syncEnabled: false,
        webhookChannelId: null,
        webhookResourceId: null,
        webhookExpiration: null,
      },
    });

    return true;
  } catch (error) {
    console.error('Error revoking access:', error);
    return false;
  }
}
