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

### 6. Google Calendar → TC Helper Not Auto-Syncing
**Root Cause**: Events only synced to tasks if they matched a property address. Generic events were ignored.

**Fix**: Modified `syncCalendarEventToTask()` to sync ALL events from our calendar, not just property-matched ones.

**File**: `src/lib/google-calendar/calendar-to-app.ts`

---

### 7. Duplicate Events with [Task] [Task] Prefix
**Root Cause**: The `buildEventFromTask()` function added a prefix every time, even if the task title already had one (from a previous sync).

**Fixes**:
1. Added regex check to detect if title already has a prefix before adding it
2. Added extended properties search to find existing events by `tcHelperTaskId` before creating duplicates
3. Enhanced logging throughout sync process to track event creation/updates

**Files**:
- `src/lib/google-calendar/sync.ts`
- `src/lib/google-calendar/calendar-init.ts`
- `src/lib/google-calendar/webhook.ts`
- `src/app/api/google-calendar/webhook/route.ts`

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
- **ALL events from "TC Helper - Transactions" calendar sync to tasks**
- For events with property indicators: Uses fuzzy matching to link to non-archived transactions
- For events without property: Creates standalone tasks (propertyAddress=null, parseId=null, taskTypes=[])
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
- [ ] Verify initial sync completes (check lastSyncedAt)
- [ ] Verify tasks appear in Google Calendar

### TC Helper → Google Calendar
- [ ] Create a new task → verify it appears in Google Calendar
- [ ] Update a task's title → verify title updates in Google Calendar
- [ ] Update a task's due date → verify date updates in Google Calendar
- [ ] Archive a task → verify it disappears from Google Calendar
- [ ] Delete a task → verify it disappears from Google Calendar

### Google Calendar → TC Helper
- [ ] Create event in Google Calendar with property address → verify task created in app with property link
- [ ] Create event in Google Calendar WITHOUT property address → verify standalone task created in app
- [ ] Update event title in Google Calendar → verify task updated in app
- [ ] Delete event in Google Calendar → verify task archived in app
- [ ] Wait 5 minutes (polling) → verify changes sync
- [ ] Verify standalone tasks show propertyAddress=null, parseId=null, taskTypes=empty

### Manual Sync
- [ ] Click "Sync Now" → verify comprehensive re-sync happens
- [ ] Verify sync clears token and re-fetches all events
- [ ] Verify lastSyncedAt updates

### Webhook Renewal
- [ ] Verify webhook expiration is set (check database)
- [ ] Wait for cron job or manually trigger `/api/cron/renew-calendar-webhooks`
- [ ] Verify new webhook channel ID in database

---

## Files Modified

### API Routes
- `src/app/api/google-calendar/settings/route.ts` - Fixed connection status check and field name
- `src/app/api/google-calendar/sync/route.ts` - Enhanced manual sync
- `src/app/api/google-calendar/poll-sync/route.ts` - **NEW** Polling endpoint
- `src/app/api/google-calendar/webhook/route.ts` - Enhanced logging for webhook notifications
- `src/app/api/tasks/route.ts` - Added auto-sync on task creation
- `src/app/api/tasks/[id]/route.ts` - Added auto-sync on task update/delete

### Library Functions
- `src/lib/google-calendar/sync.ts` - Added delete/archive functions, duplicate prevention, prefix checking
- `src/lib/google-calendar/calendar-to-app.ts` - Sync ALL events, not just property-matched, enhanced logging
- `src/lib/google-calendar/calendar-init.ts` - Added webhook setup logging
- `src/lib/google-calendar/webhook.ts` - Added webhook creation logging and URL validation
- `src/lib/google-calendar/sync-timeline-events.ts` - Fixed undefined variable bug

### Components
- `src/components/settings/CalendarSyncSettings.tsx` - Added polling mechanism, fixed field names

### Types
- `src/types/calendar.ts` - Fixed field name from lastSyncAt to lastSyncedAt

### Documentation
- `GOOGLE_CALENDAR_SYNC_FIXES.md` - Comprehensive documentation of all changes

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

---

## Troubleshooting

### Automatic Sync Not Working

If events created in Google Calendar are not syncing to the app:

1. **Check Webhook Status**:
   - Click the "Debug Sync" button in Calendar Settings
   - Check browser console for webhook diagnostic info
   - Look for:
     - `hasChannelId`: Should be `true`
     - `hasResourceId`: Should be `true`
     - `isExpired`: Should be `false`
     - `expiresIn`: Should show hours remaining

2. **Check Environment Variable**:
   ```bash
   # In Vercel dashboard, check that NEXT_PUBLIC_APP_URL is set
   # It should be: https://your-production-domain.com
   ```

3. **Check Vercel Logs**:
   - Look for `[Webhook Setup]` logs during initial connection
   - Look for `[Webhook]` logs when events are created
   - Look for `[Calendar→App]` logs during sync

4. **Manual Sync Test**:
   - Create an event in Google Calendar
   - Click "Debug Sync" button in settings
   - Check if event appears in Tasks view
   - Check console logs for sync results

5. **Test Webhook Endpoint**:
   ```bash
   # Test if webhook endpoint is accessible
   curl https://your-domain.com/api/google-calendar/webhook
   # Should return: {"status":"Webhook endpoint active"}
   ```

6. **Check Database**:
   - Open Prisma Studio: `npm run db:studio`
   - Navigate to `CalendarSettings` table
   - Check fields:
     - `webhookChannelId` - should have UUID value
     - `webhookResourceId` - should have Google resource ID
     - `webhookExpiration` - should be future date
     - `nextSyncToken` - may be null or have token value

### Expected Log Flow

**During Initial Connection:**
```
[Calendar Init] Setting up webhook for user <userId>...
[Webhook Setup] Creating watch channel for user <userId>
[Webhook Setup] Webhook URL: https://your-domain.com/api/google-calendar/webhook
[Webhook Setup] Channel ID: <uuid>
[Webhook Setup] Watch created successfully. Resource ID: <resourceId>, Expiration: <timestamp>
[Calendar Init] Webhook setup successful. Channel ID: <uuid>, Expiration: <date>
```

**When Event Created in Google Calendar:**
```
[Webhook] Received notification. Channel: <uuid>, State: exists
[Webhook] Triggering sync for User: <userId> (resourceState: exists)...
[Calendar→App Sync] Processing X events for user <userId>
[Calendar→App] Created task "<task-title>" (parseId: <id or none>)
[Webhook] Sync complete for <userId>. Created: 1, Updated: 0, Deleted: 0, Processed: 1
```

**During Polling (Every 5 minutes):**
```
[Calendar→App Sync] Processing X events for user <userId>
```

### Common Issues

1. **Webhook Never Set Up**:
   - Symptom: `webhookChannelId` is `null` in database
   - Solution: Disconnect and reconnect Google Calendar

2. **Webhook Expired**:
   - Symptom: `isExpired: true` in debug sync
   - Solution: Wait for cron job to renew, or disconnect/reconnect

3. **NEXT_PUBLIC_APP_URL Not Set**:
   - Symptom: Webhook setup fails with error about missing URL
   - Solution: Set environment variable in Vercel dashboard

4. **Webhook URL Not Accessible**:
   - Symptom: Webhook set up successfully but no notifications received
   - Solution: Check firewall, ensure URL is publicly accessible

5. **Sync Token Issues**:
   - Symptom: Polling works but only fetches old events
   - Solution: Click "Sync Now" to force comprehensive re-sync
