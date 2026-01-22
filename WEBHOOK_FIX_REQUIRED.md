# 🚨 URGENT: Webhook Fix Required

## Problem Identified

**Root Cause**: Webhook URL has a redirect that breaks Google Calendar notifications

### Current Situation

```bash
# Your webhook is registered to:
https://tchelper.app/api/google-calendar/webhook

# But this URL returns 307 redirect:
$ curl -I https://tchelper.app/api/google-calendar/webhook
HTTP/2 307
location: https://www.tchelper.app/api/google-calendar/webhook

# The correct URL (with www) works:
$ curl -I https://www.tchelper.app/api/google-calendar/webhook
HTTP/2 200
{"status":"Webhook endpoint active"}
```

**Google Calendar webhooks DO NOT follow redirects.**

When Google tries to send webhook notifications:
1. Google sends POST to `https://tchelper.app/api/google-calendar/webhook`
2. Gets 307 redirect to `https://www.tchelper.app/...`
3. **Gives up and drops the notification** ❌

This is why you're seeing polling work (5-minute intervals) but no webhook logs.

## Fix Steps

### Step 1: Update Environment Variable

**In Vercel Dashboard:**
1. Go to: Settings → Environment Variables
2. Find: `NEXT_PUBLIC_APP_URL`
3. **Current value**: `https://tchelper.app`
4. **Change to**: `https://www.tchelper.app` *(add www)*
5. Save changes
6. **Redeploy** the application

### Step 2: Reconnect Google Calendar

After redeployment completes:

1. Open TC Helper App → Settings
2. Click **"Disconnect"** under Google Calendar
3. Click **"Connect Google Calendar"**
4. Complete OAuth flow

This will register a new webhook with the correct URL.

### Step 3: Verify Fix

**Test immediate sync:**
1. Create an event in Google Calendar
2. Check Vercel logs within 10 seconds
3. Should see: `[Webhook] Received notification. Channel: ...`

**Check webhook logs:**
```
[Webhook] Received notification. Channel: <uuid>, State: exists
[Webhook] Triggering sync for User: <userId>...
[Calendar→App Sync] Processing X events for user <userId>
[Calendar→App] Created task "<title>" (parseId: ...)
[Webhook] Sync complete for <userId>. Created: 1, Updated: 0...
```

## Expected Behavior After Fix

### Before Fix (Current)
- ❌ Webhooks: Not working (redirect issue)
- ✅ Polling: Working (5-minute delay)
- ⏱️ Sync speed: Up to 5 minutes

### After Fix
- ✅ Webhooks: Working (near real-time)
- ✅ Polling: Still running (fallback)
- ⚡ Sync speed: **2-5 seconds**

## Alternative Fix (If You Don't Want to Use www)

If you prefer to keep `tchelper.app` without `www`:

1. Remove the redirect in your DNS/hosting config
2. OR set up the redirect to work both ways
3. Keep `NEXT_PUBLIC_APP_URL=https://tchelper.app`

The key is: **Webhook URL must not return a redirect.**

## Why This Wasn't Caught Earlier

- Webhook setup succeeds (Google accepts the registration)
- Verification request works (initial handshake)
- BUT: Subsequent notifications fail silently on the redirect
- Polling mechanism masked the issue (sync still happened, just slower)

## Progressive Onboarding Question

**Q**: Why is progressive-onboarding syncing tasks to calendar?

**A**: It's not. The timing is coincidental:
- Progressive onboarding checks happen on page load
- Tasks may sync to calendar around the same time
- Both operations show up in logs together
- This is **normal behavior**, not a bug

Task sync to calendar happens when:
- Tasks are created via API
- Tasks are updated via API
- Initial sync runs after connecting calendar
- NOT related to onboarding checks

## Summary

1. ✅ Calendar sync logic is working correctly
2. ✅ Polling fallback is functioning (5-minute intervals)
3. ❌ Webhooks failing due to 307 redirect
4. 🎯 Fix: Update `NEXT_PUBLIC_APP_URL` to `https://www.tchelper.app`
5. 🔄 Then: Reconnect Google Calendar
6. ⚡ Result: Near real-time sync (seconds instead of minutes)
