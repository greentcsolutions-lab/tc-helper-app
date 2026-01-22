# Google Calendar Sync Fixes

## Branch: `fix/google-calendar-sync`

## Issues Fixed

### 1. Connect Button Still Showing After Initial Sync
**Root Cause**: The settings API was only checking `primaryCalendarId` to determine connection status, not verifying that the initial sync completed.

**Fix**: Updated `/api/google-calendar/settings` to check both `primaryCalendarId` AND `initialSyncCompleted` flags.

**File**: `src/app/api/google-calendar/settings/route.ts`

---

### 2. New Tasks Not Syncing to Google Calendar
**Root Cause**: When tasks were created or updated via the API, there was no automatic trigger to sync them to Google Calendar.

**Fixes**:
1. **Task Creation**: Added automatic sync call in `POST /api/tasks/route.ts` after task creation
2. **Task Updates**: Added automatic sync call in `PATCH /api/tasks/[id]/route.ts` after task updates
3. **Task Deletion**: Added calendar cleanup in `DELETE /api/tasks/[id]/route.ts` before task deletion
4. **Task Archiving**: Added archive handling to remove events from calendar when tasks are archived

**Files**:
- `src/app/api/tasks/route.ts`
- `src/app/api/tasks/[id]/route.ts`
- `src/lib/google-calendar/sync.ts` (added `deleteTaskFromCalendar` and `archiveTaskInCalendar` functions)

---

### 3. Manual Refresh Not Comprehensive
**Root Cause**: Manual sync was using existing sync tokens, which could miss discrepancies if events were modified outside the sync window.

**Fix**: Clear sync token when manual refresh is triggered to force a comprehensive re-sync from Google Calendar (limited to 3 months back/forward to avoid massive loads).

**File**: `src/app/api/google-calendar/sync/route.ts`

---

### 4. No Polling Fallback Mechanism
**Root Cause**: If webhooks failed or were delayed, there was no backup mechanism to ensure sync happened.

**Fixes**:
1. Created new polling endpoint `/api/google-calendar/poll-sync`
2. Added client-side polling in `CalendarSyncSettings.tsx` that triggers every 5 minutes
3. Polling uses incremental sync with sync tokens for efficiency

**Files**:
- `src/app/api/google-calendar/poll-sync/route.ts` (new file)
- `src/components/settings/CalendarSyncSettings.tsx`

---

### 5. Bug Fix: Undefined Variable
**Root Cause**: In `sync-timeline-events.ts`, the variable `endDate` was referenced but not defined when searching for existing events.

**Fix**: Defined `endDateObj` properly before using it in the search.

**File**: `src/lib/google-calendar/sync-timeline-events.ts`

---

## How Bidirectional Sync Works Now

### TC Helper → Google Calendar (App to Calendar)

**When it happens**:
1. **Task Creation**: Automatically when a task is created via `/api/tasks`
2. **Task Update**: Automatically when a task is updated via `/api/tasks/[id]`
3. **Task Deletion**: Automatically when a task is deleted via `/api/tasks/[id]`
4. **Task Archiving**: Automatically when a task is archived via `/api/tasks/[id]`
5. **Manual Sync**: When user clicks "Sync Now" button with direction set to `app-to-calendar` or `both`

**How it works**:
- Calls `syncTaskToCalendar(userId, taskId)` which creates or updates the event in Google Calendar
- Stores the `googleCalendarEventId` on the Task model for future updates
- Uses extended properties to tag events with `tcHelperTaskId` for identification

### Google Calendar → TC Helper (Calendar to App)

**When it happens**:
1. **Webhook (Real-time)**: Google sends webhook notification when events are created/updated/deleted
2. **Polling (Every 5 minutes)**: Client polls `/api/google-calendar/poll-sync` as fallback
3. **Manual Sync**: When user clicks "Sync Now" button with direction set to `calendar-to-app` or `both`

**How it works**:
- Uses Google Calendar API's **Incremental Sync with Sync Tokens**
- First sync fetches events from 3 months ago to present
- Subsequent syncs only fetch changes since last sync token
- Sync token is stored in `CalendarSettings.nextSyncToken`
- If sync token expires (410 error), automatically clears token and re-syncs
- Uses AI inference to match events to properties and determine task types
- Creates/updates/deletes tasks in the database based on calendar changes

---

## Sync Token Strategy

### Initial Sync
1. User connects Google Calendar
2. `initializeCalendars()` creates calendar and sets `initialSyncCompleted = true`
3. `setupWebhook()` establishes webhook channel
4. First call to `syncCalendarToApp()` has no sync token, so fetches 3 months of events
5. Stores `nextSyncToken` from response

### Incremental Syncs
1. Webhook triggers or polling occurs
2. `syncCalendarToApp()` uses stored `nextSyncToken`
3. Only receives events that changed since last sync
4. Updates `nextSyncToken` with new token from response

### Manual Refresh (Comprehensive)
1. User clicks "Sync Now"
2. `nextSyncToken` is cleared
3. Full sync re-fetches 3 months of events
4. New sync token is stored

### Token Expiration Handling
1. If token expires, Google returns 410 error
2. Code catches 410, clears token, and recursively calls sync
3. Next call does full sync and gets new token

---

## Webhook Management

### Initial Setup
- Webhook is created during `initializeCalendars()`
- Webhook URL: `https://[app-domain]/api/google-calendar/webhook`
- Channel ID and Resource ID are stored in database
- Expiration is typically 7 days from creation

### Renewal
- **Automatic**: Cron job runs every 6 hours (`/api/cron/renew-calendar-webhooks`)
- Checks for webhooks expiring within 24 hours
- Stops old webhook channel and creates new one
- Updates database with new channel ID and expiration

### Webhook Flow
1. Google sends POST to webhook endpoint when events change
2. Endpoint identifies user by channel ID
3. Triggers `syncCalendarToApp()` with sync token
4. Returns 200 OK to Google

---

## Polling Mechanism

### Purpose
Acts as a fallback if webhooks fail or are delayed

### Configuration
- **Interval**: Every 5 minutes
- **Trigger**: Only when `isConnected && syncEnabled`
- **Method**: Uses same incremental sync with sync tokens

### Implementation
- Client-side `useEffect` in `CalendarSyncSettings.tsx`
- Calls `/api/google-calendar/poll-sync` endpoint
- Silent operation (no UI feedback unless manual sync)

---

## Testing Checklist

### Initial Connection
- [ ] Connect Google Calendar from Settings
- [ ] Verify "Connect Google Calendar" button disappears
- [ ] Verify initial sync completes (check lastSyncAt)
- [ ] Verify tasks appear in Google Calendar

### TC Helper → Google Calendar
- [ ] Create a new task → verify it appears in Google Calendar
- [ ] Update a task's title → verify title updates in Google Calendar
- [ ] Update a task's due date → verify date updates in Google Calendar
- [ ] Archive a task → verify it disappears from Google Calendar
- [ ] Delete a task → verify it disappears from Google Calendar

### Google Calendar → TC Helper
- [ ] Create event in Google Calendar with property address → verify task created in app
- [ ] Update event title in Google Calendar → verify task updated in app
- [ ] Delete event in Google Calendar → verify task archived in app
- [ ] Wait 5 minutes (polling) → verify changes sync

### Manual Sync
- [ ] Click "Sync Now" → verify comprehensive re-sync happens
- [ ] Verify sync clears token and re-fetches all events
- [ ] Verify lastSyncAt updates

### Webhook Renewal
- [ ] Verify webhook expiration is set (check database)
- [ ] Wait for cron job or manually trigger `/api/cron/renew-calendar-webhooks`
- [ ] Verify new webhook channel ID in database

---

## Files Modified

### API Routes
- `src/app/api/google-calendar/settings/route.ts` - Fixed connection status check
- `src/app/api/google-calendar/sync/route.ts` - Enhanced manual sync
- `src/app/api/google-calendar/poll-sync/route.ts` - **NEW** Polling endpoint
- `src/app/api/tasks/route.ts` - Added auto-sync on task creation
- `src/app/api/tasks/[id]/route.ts` - Added auto-sync on task update/delete

### Library Functions
- `src/lib/google-calendar/sync.ts` - Added delete/archive functions
- `src/lib/google-calendar/sync-timeline-events.ts` - Fixed undefined variable bug

### Components
- `src/components/settings/CalendarSyncSettings.tsx` - Added polling mechanism

### Configuration
- `.claude-branch` - **NEW** Branch tracking for crash recovery

---

## Environment Variables Required

No new environment variables needed. Existing variables:
- `NEXT_PUBLIC_APP_URL` - For webhook URL
- `CRON_SECRET` - For cron job authentication (optional but recommended)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` - For OAuth

---

## Deployment Notes

1. **Webhook URL Must Be Publicly Accessible**: Ensure `NEXT_PUBLIC_APP_URL` is set to production URL
2. **Cron Job Configured**: Vercel cron is already configured in `vercel.json`
3. **Database Migration**: No schema changes required
4. **Testing**: Test all scenarios in staging before production deployment
