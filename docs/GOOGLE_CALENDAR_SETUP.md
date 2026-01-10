# Google Calendar Integration Setup

This guide walks you through setting up Google Calendar integration for the TC Helper app.

## Overview

The Google Calendar integration provides:
- **Bidirectional sync**: Changes in the app sync to Google Calendar and vice versa
- **Dedicated calendars**: "TC Helper" for active tasks, "TC Helper Archived Events" for archived items
- **Smart property matching**: Events with property addresses automatically sync
- **AI-powered classification**: BASIC plan users get AI-inferred task types for external events
- **Real-time updates**: Webhook-based push notifications for instant sync
- **Non-app event display**: See other calendar events as grayed-out blocks (no details)

## Prerequisites

1. Google Cloud Platform account
2. TC Helper app with authentication (Clerk) configured
3. PostgreSQL database
4. Gemini API key (for AI features)

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google Calendar API**:
   - Navigate to "APIs & Services" → "Library"
   - Search for "Google Calendar API"
   - Click "Enable"

## Step 2: Configure OAuth Consent Screen

1. Go to "APIs & Services" → "OAuth consent screen"
2. Choose "External" user type (unless you have Google Workspace)
3. Fill in required fields:
   - App name: "TC Helper"
   - User support email: your email
   - Developer contact: your email
4. Add scopes:
   - `https://www.googleapis.com/auth/calendar`
   - `https://www.googleapis.com/auth/calendar.events`
5. Add test users (during development)
6. Save and continue

## Step 3: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth 2.0 Client ID"
3. Choose "Web application"
4. Configure:
   - Name: "TC Helper Web"
   - Authorized redirect URIs:
     - Development: `http://localhost:3000/api/google-calendar/callback`
     - Production: `https://yourdomain.com/api/google-calendar/callback`
5. Click "Create"
6. Save the **Client ID** and **Client Secret**

## Step 4: Configure Environment Variables

Add these to your `.env.local` (development) or Vercel environment variables (production):

```bash
# Google Calendar Integration
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/google-calendar/callback

# For production
# GOOGLE_REDIRECT_URI=https://yourdomain.com/api/google-calendar/callback

# Required for webhook security (optional but recommended)
CRON_SECRET=your-random-secret-string
```

## Step 5: Run Database Migration

```bash
npm run prisma migrate deploy
```

Or manually apply the migration:
```bash
npx prisma migrate dev
```

## Step 6: Configure Webhook URL

For webhooks to work, your app must be accessible from the internet. In development:

1. Use a tunneling service like [ngrok](https://ngrok.com/):
   ```bash
   ngrok http 3000
   ```

2. Update `NEXT_PUBLIC_APP_URL` to your ngrok URL:
   ```bash
   NEXT_PUBLIC_APP_URL=https://your-ngrok-url.ngrok.io
   ```

3. Add the ngrok callback URL to Google OAuth redirect URIs

In production, use your actual domain.

## Step 7: Test the Integration

1. Start your app:
   ```bash
   npm run dev
   ```

2. Navigate to Settings → Calendar Sync

3. Click "Connect Google Calendar"

4. Authorize the app in the Google OAuth flow

5. Verify:
   - "TC Helper" and "TC Helper Archived Events" calendars are created
   - Existing tasks appear in the TC Helper calendar
   - Create a new task and check it syncs to Google Calendar
   - Create an event in Google Calendar with a property address and verify it syncs to the app

## Architecture

### Sync Flow

```
App Task Created/Updated
  ↓
syncTaskToCalendar()
  ↓
Google Calendar Event Created/Updated
  ↓
Webhook Notification Sent
  ↓
/api/google-calendar/webhook
  ↓
syncCalendarToApp()
  ↓
App Tasks Updated (if external changes)
```

### Components

- **Client** (`src/lib/google-calendar/client.ts`): OAuth and API client management
- **Sync** (`src/lib/google-calendar/sync.ts`): App → Calendar sync logic
- **Calendar-to-App** (`src/lib/google-calendar/calendar-to-app.ts`): Calendar → App sync logic
- **Webhook** (`src/lib/google-calendar/webhook.ts`): Push notification management
- **Property Matcher** (`src/lib/google-calendar/property-matcher.ts`): Fuzzy address matching
- **AI Inference** (`src/lib/google-calendar/ai-inference.ts`): Gemini-powered task classification

### Database Models

- **CalendarSettings**: User preferences and OAuth tokens
- **CalendarEvent**: Tracks all calendar events (app and non-app)
- **Task**: Extended with `googleCalendarEventId` for sync tracking

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/google-calendar/connect` | GET | Get OAuth URL |
| `/api/google-calendar/callback` | GET | OAuth callback handler |
| `/api/google-calendar/disconnect` | POST | Revoke access |
| `/api/google-calendar/settings` | GET/PATCH | Get/update settings |
| `/api/google-calendar/sync` | POST | Manual sync trigger |
| `/api/google-calendar/webhook` | POST | Webhook handler |

## Troubleshooting

### Webhook Not Receiving Updates

1. Ensure your app is publicly accessible
2. Check webhook expiration: `GET /api/google-calendar/settings`
3. Manually renew: The cron job runs every 6 hours, or trigger manually
4. Check logs for webhook errors

### Tasks Not Syncing

1. Verify calendar settings: `syncEnabled` should be `true`
2. Check `lastSyncError` in settings API response
3. Manually trigger sync: `POST /api/google-calendar/sync`
4. Verify OAuth tokens are valid (check expiry)

### Address Matching Not Working

1. Ensure property address is set in Parse records
2. Check address format: Should include street number and name
3. Test fuzzy matching with variations (e.g., "123 Main" vs "123 Main Street")

### AI Inference Not Working (BASIC Plan)

1. Verify user has `planType: 'BASIC'`
2. Check `GEMINI_API_KEY` is set
3. Review logs for Gemini API errors
4. Ensure event has sufficient context (title + description)

## Security Considerations

1. **Token Storage**: OAuth tokens are stored encrypted in the database
2. **Webhook Verification**: Validates channel ID and resource ID
3. **Cron Security**: Use `CRON_SECRET` to protect cron endpoints
4. **Financial Data**: `excludeFinancialData` prevents amounts from syncing to calendar
5. **User Isolation**: All queries are scoped to `userId`

## Future Enhancements

- [ ] Conflict detection (team member double-booking)
- [ ] Smart scheduling suggestions
- [ ] Calendar sharing for teams
- [ ] Bulk operations (archive all completed tasks)
- [ ] Calendar analytics and insights
- [ ] Integration with other calendar providers (Outlook, Apple Calendar)

## Support

For issues or questions:
1. Check logs in `/api/google-calendar/settings`
2. Review webhook status and expiration
3. Test with manual sync
4. Contact support with error details
