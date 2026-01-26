// src/lib/gmail/client.ts
// Gmail API client wrapper for Comms Center

import { google, gmail_v1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '@/lib/prisma';

// Gmail OAuth Scopes
export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.labels',
  'https://www.googleapis.com/auth/userinfo.email',
];

// TC Helper Label name
export const TC_HELPER_LABEL_NAME = 'TC Helper';

/**
 * Creates and configures a Gmail client for a user
 */
export async function getGmailClient(userId: string): Promise<gmail_v1.Gmail | null> {
  try {
    const settings = await prisma.gmailSettings.findUnique({
      where: { userId },
    });

    if (!settings || !settings.googleAccessToken || !settings.googleRefreshToken) {
      return null;
    }

    const oauth2Client = createOAuth2Client();

    oauth2Client.setCredentials({
      access_token: settings.googleAccessToken,
      refresh_token: settings.googleRefreshToken,
      expiry_date: settings.googleTokenExpiry?.getTime(),
    });

    // Set up token refresh handler
    oauth2Client.on('tokens', async (tokens) => {
      if (tokens.access_token) {
        await prisma.gmailSettings.update({
          where: { userId },
          data: {
            googleAccessToken: tokens.access_token,
            googleTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
          },
        });
      }
    });

    return google.gmail({ version: 'v1', auth: oauth2Client });
  } catch (error) {
    console.error('[Gmail] Error creating client:', error);
    return null;
  }
}

/**
 * Creates OAuth2 client for authorization flow
 */
export function createOAuth2Client(): OAuth2Client {
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/gmail/callback`
  );
}

/**
 * Generates the Google OAuth consent URL for Gmail
 */
export function getGmailAuthUrl(state?: string): string {
  const oauth2Client = createOAuth2Client();

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: GMAIL_SCOPES,
    prompt: 'consent',
    state: state,
  });
}

/**
 * Exchanges authorization code for tokens
 */
export async function getTokensFromCode(code: string) {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

/**
 * Gets the user's Gmail address from the API
 */
export async function getGmailAddress(gmail: gmail_v1.Gmail): Promise<string | null> {
  try {
    const profile = await gmail.users.getProfile({ userId: 'me' });
    return profile.data.emailAddress || null;
  } catch (error) {
    console.error('[Gmail] Error getting profile:', error);
    return null;
  }
}

/**
 * Creates or finds the TC Helper label in Gmail
 */
export async function ensureTcHelperLabel(gmail: gmail_v1.Gmail): Promise<string | null> {
  try {
    // First, try to find existing label
    const labelsResponse = await gmail.users.labels.list({ userId: 'me' });
    const existingLabel = labelsResponse.data.labels?.find(
      (label) => label.name === TC_HELPER_LABEL_NAME
    );

    if (existingLabel?.id) {
      return existingLabel.id;
    }

    // Create new label
    const createResponse = await gmail.users.labels.create({
      userId: 'me',
      requestBody: {
        name: TC_HELPER_LABEL_NAME,
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show',
        color: {
          backgroundColor: '#16a765', // Green
          textColor: '#ffffff',
        },
      },
    });

    return createResponse.data.id || null;
  } catch (error) {
    console.error('[Gmail] Error ensuring TC Helper label:', error);
    return null;
  }
}

/**
 * Refreshes access token using refresh token
 */
export async function refreshGmailAccessToken(userId: string): Promise<boolean> {
  try {
    const settings = await prisma.gmailSettings.findUnique({
      where: { userId },
    });

    if (!settings || !settings.googleRefreshToken) {
      return false;
    }

    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials({
      refresh_token: settings.googleRefreshToken,
    });

    const { credentials } = await oauth2Client.refreshAccessToken();

    await prisma.gmailSettings.update({
      where: { userId },
      data: {
        googleAccessToken: credentials.access_token || null,
        googleTokenExpiry: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
      },
    });

    return true;
  } catch (error) {
    console.error('[Gmail] Error refreshing token:', error);
    return false;
  }
}

/**
 * Revokes Gmail access and cleans up tokens
 */
export async function revokeGmailAccess(userId: string): Promise<boolean> {
  try {
    const settings = await prisma.gmailSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      return true; // Already disconnected
    }

    if (settings.googleAccessToken) {
      const oauth2Client = createOAuth2Client();
      oauth2Client.setCredentials({
        access_token: settings.googleAccessToken,
      });

      try {
        await oauth2Client.revokeCredentials();
      } catch (error) {
        console.error('[Gmail] Error revoking credentials:', error);
        // Continue to clean up our database
      }
    }

    // Clear tokens and set disconnection timestamp
    await prisma.gmailSettings.update({
      where: { userId },
      data: {
        googleAccessToken: null,
        googleRefreshToken: null,
        googleTokenExpiry: null,
        webhookHistoryId: null,
        webhookExpiration: null,
        disconnectedAt: new Date(),
      },
    });

    return true;
  } catch (error) {
    console.error('[Gmail] Error revoking access:', error);
    return false;
  }
}

/**
 * Check if user has Gmail connected
 */
export async function isGmailConnected(userId: string): Promise<boolean> {
  const settings = await prisma.gmailSettings.findUnique({
    where: { userId },
    select: { googleAccessToken: true, googleRefreshToken: true },
  });

  return !!(settings?.googleAccessToken && settings?.googleRefreshToken);
}
