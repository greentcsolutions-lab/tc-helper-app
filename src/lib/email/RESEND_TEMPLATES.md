# Resend Email Templates

This document lists all email templates that must be created in the **Resend dashboard** at https://resend.com/emails/templates.

## Required Templates

### 1. `welcome-email` ✓ ALREADY EXISTS

**Template ID:** `welcome-email`
**From:** TC Helper <onboarding@updates.tchelper.app>
**Subject:** Welcome to TC Helper!

**Variables:**
- `first_name` (string) - User's first name

**Purpose:** Sent when a user completes onboarding

**Status:** Already created and in use

---

### 2. `upload-rejected` (NEW - REQUIRED)

**Template ID:** `upload-rejected`
**From:** TC Helper Status <status@mail.tchelper.app>
**Subject:** TC Helper - Upload Request Blocked

**Variables:**
- `reason` (string) - Primary rejection reason
- `help_text` (string, optional) - Additional helpful guidance
- `details` (object, optional) - Key-value pairs with additional details

**Purpose:** Sent when an email-based PDF upload fails validation

**Common Rejection Reasons:**
- Email not registered
- Insufficient credits
- Parse limit reached
- Rate limit exceeded (5/hour)
- Invalid PDF (not exactly 1 PDF, size >25MB, >100 pages, corrupted)

**Design Guidelines:**
- Red header color (#dc2626)
- Light background (#f9fafb)
- Reason box with left border (red)
- Helpful CTA links to dashboard/billing
- Professional, apologetic tone

**Example Variables:**
```json
{
  "reason": "You've reached the maximum of 5 emails per hour. Please try again after 3:45 PM.",
  "help_text": "This limit helps us maintain system stability. You can always upload PDFs directly through the dashboard.",
  "details": {
    "current_count": "5",
    "limit": "5",
    "reset_at": "3:45 PM PST"
  }
}
```

---

### 3. `extraction-failed` (NEW - REQUIRED)

**Template ID:** `extraction-failed`
**From:** TC Helper Status <status@mail.tchelper.app>
**Subject:** TC Helper - Extraction Failed: {{file_name}}

**Variables:**
- `file_name` (string) - Name of the PDF file
- `error_message` (string, optional) - Technical error details
- `dashboard_url` (string) - Link to dashboard for manual upload

**Purpose:** Sent when AI extraction fails after a successful upload

**Design Guidelines:**
- Red header with ⚠️ warning emoji
- Error box showing technical details (if available)
- Strong CTA button: "Try Manual Upload"
- Link to dashboard
- Reassuring message that no credit was charged (if applicable)

**Example Variables:**
```json
{
  "file_name": "contract_2026.pdf",
  "error_message": "Both AI providers (Gemini and Claude) timed out. The PDF may be too complex or contain scanned images.",
  "dashboard_url": "https://tchelper.app/dashboard"
}
```

---

### 4. `extraction-success` (NEW - REQUIRED)

**Template ID:** `extraction-success`
**From:** TC Helper Status <status@mail.tchelper.app>
**Subject:** TC Helper - Extraction Complete: {{property_address}}

**Variables:**
- `file_name` (string) - Name of the PDF file
- `property_address` (string) - Extracted property address
- `transaction_type` (string) - Purchase/Sale/Lease
- `buyer_names` (string) - Comma-separated buyer names
- `seller_names` (string) - Comma-separated seller names
- `purchase_price` (string) - Formatted currency (e.g., "$450,000")
- `earnest_money` (string) - Formatted currency
- `closing_date` (string) - Formatted date (e.g., "January 24, 2026")
- `effective_date` (string) - Formatted date
- `financing` (string) - "All Cash" or loan type
- `escrow_holder` (string) - Escrow company name
- `transaction_url` (string) - Direct link to transaction details
- `dashboard_url` (string) - Link to dashboard

**Purpose:** Sent when extraction completes successfully

**Design Guidelines:**
- Green gradient header (#10b981 to #059669)
- Large success checkmark ✓
- Clean data table showing extracted information
- Two CTA buttons: "View Transaction Details" (primary blue) + "Go to Dashboard" (secondary gray)
- Pro tip box with information icon
- Professional, celebratory tone

**Example Variables:**
```json
{
  "file_name": "contract_2026.pdf",
  "property_address": "123 Main St, Austin, TX 78701",
  "transaction_type": "Purchase",
  "buyer_names": "John Doe, Jane Doe",
  "seller_names": "Bob Smith",
  "purchase_price": "$450,000",
  "earnest_money": "$5,000",
  "closing_date": "March 15, 2026",
  "effective_date": "January 24, 2026",
  "financing": "Conventional Loan",
  "escrow_holder": "ABC Title Company",
  "transaction_url": "https://tchelper.app/transactions?id=abc123",
  "dashboard_url": "https://tchelper.app/dashboard"
}
```

---

### 5. `support-received` (FUTURE - NOT REQUIRED YET)

**Template ID:** `support-received`
**From:** TC Helper Support <support@mail.tchelper.app>
**Subject:** We received your support request

**Variables:**
- `user_name` (string) - User's first name
- `ticket_id` (string) - Support ticket ID
- `subject` (string) - Support request subject/summary
- `expected_response_time` (string) - E.g., "within 24 hours"

**Purpose:** Auto-reply when user emails support@mail.tchelper.app

**Status:** Not needed until Phase 3 (Support Inbound)

---

## Template Creation Checklist

Before deploying the refactored email system, create these templates in Resend:

- [x] `welcome-email` (already exists)
- [ ] `upload-rejected`
- [ ] `extraction-failed`
- [ ] `extraction-success`
- [ ] `support-received` (Phase 3 only)

## Testing Templates

After creating each template:

1. Test in Resend dashboard's template preview
2. Send test emails with sample variables
3. Verify rendering in Gmail, Outlook, Apple Mail
4. Check mobile responsiveness
5. Validate all variable substitutions work correctly

## Variable Formatting

All variables should be formatted **before** passing to Resend:

- Dates: Use `Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric' })`
- Currency: Use `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 })`
- Arrays: Join with `, ` (comma-space)
- Missing values: Use `'N/A'` instead of null/undefined

See `src/lib/email/outbound/system/extraction-success.ts` for formatting helper functions (once migrated).
