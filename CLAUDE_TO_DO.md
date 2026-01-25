# CLAUDE TO-DO: Email System Next Steps

## Context
Phases 1 & 2 of email system refactoring are complete. This file tracks remaining work for future sessions.

## Next Steps Required (Before Deploying)

### 1. Create 3 New Resend Templates
Create these templates in the Resend dashboard. Full specs are in `src/lib/email/RESEND_TEMPLATES.md`:

- **upload-rejected** - Rejection notification
- **extraction-failed** - Extraction failure
- **extraction-success** - Success summary with extracted data

### 2. Delete Old Email Files
These files are now unused (kept for compatibility during refactor):

- `src/lib/email/send-welcome-email.ts`
- `src/lib/email/send-rejection-email.ts`
- `src/lib/email/send-extraction-failed-email.ts`
- `src/lib/email/send-extraction-success-email.ts`
- `src/lib/email/validate-inbound.ts`
- `src/lib/email/rate-limiter.ts` (old version, replaced by `inbound/rate-limiter.ts`)
- `src/lib/email/parse-email-notes.ts` (old version, replaced by `inbound/extraction/parse-email-notes.ts`)

### 3. Update Communication Model (Prisma Schema)
Add fields to support the new email architecture:

```prisma
model Communication {
  // Existing fields...

  // Add these:
  category    String?  // 'extraction' | 'support' | 'user-generated' | 'system'
  threadId    String?  // For email threading support (Phase 3)
  templateId  String?  // Resend template ID used
  templateVars Json?   // Template variables for tracking
}
```

After updating:
- Run `npm run db:migrate:create` to create migration
- Run `npm run db:migrate:deploy` to apply

### 4. Test End-to-End
- Send test email to upload@mail.tchelper.app
- Verify webhook processes correctly
- Verify rejection/success emails sent via new templates
- Test rate limiting (5/hr for extraction, 10/hr for support)

## Future Phases (Not Built Yet)

### Phase 3 - Support Inbound
- Create support email handler for support@mail.tchelper.app
- Implement support ticket threading & auto-reply
- Add to router in `src/lib/email/inbound/router.ts`

### Phase 4 - User-Generated Messages
- Build API to list available Resend templates for users
- Build API to send email with user-selected template
- Create frontend UI for email composition
- Allow users to send custom emails using approved templates

## Key Architecture Files

Reference these for context:
- **Architecture decisions**: `src/lib/email/RESEND_TEMPLATES.md`
- **Constants & limits**: `src/lib/email/constants.ts`
- **Type definitions**: `src/lib/email/types.ts`
- **Main webhook**: `src/app/api/email/inbound/route.ts` (87 lines, clean router)
- **Extraction handler**: `src/lib/email/inbound/extraction/handler.ts`

## Current Status

✅ **Complete:**
- Phase 1: Foundation & refactoring (15 new modules)
- Phase 2: System email outbound with template support
- Inbound webhook reduced from 433 lines → 87 lines
- All email code is TypeScript-clean (no type errors)

⏳ **In Progress:**
- Template creation in Resend dashboard
- Database schema updates
- End-to-end testing

🔜 **Future:**
- Phase 3: Support inbound routing
- Phase 4: User-generated messages

---

**Last Updated**: 2026-01-25 (during email system refactoring session)
