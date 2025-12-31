// src/lib/extraction/prompts/universal-extractor-prompt.ts
// Version: 11.0.0 - 2025-12-31
// MAJOR UPDATE: Removed effectiveDate (now calculated), added signature date extraction

import extractorSchema from '@/forms/universal/extractor.schema.json';

const schemaString = JSON.stringify(extractorSchema, null, 2);

export function buildUniversalExtractorPrompt(
  criticalImages: Array<{ pageNumber: number; label: string }>
): string {
  return `You are a document OCR specialist. Extract data from ${criticalImages.length} real estate contract page images.

Your job: Extract EXACTLY what you see on each page. Nothing more, nothing less.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Extract from ENTIRE page (headers + body + footers)
2. **PROPERTY ADDRESS is in the page header on 95% of pages - look at the very top**
3. Return null ONLY if field is truly not visible anywhere on the page
4. DO NOT skip header fields - they contain real data
5. DO NOT make assumptions about what "should" be on a page
6. DO NOT apply business logic about overrides or changes
7. DO NOT normalize dates - extract EXACTLY as written
8. IGNORE agent/broker signatures - we only care about buyer and seller signatures

One JSON object per image. Extract what you see.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PAGE IDENTIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Extract these by reading the page itself:

formCode: Form identifier from footer/header
  Examples: "RPA", "SCO", "BCO", "TREC 20-16", "FAR/BAR-6"

formPage: Which page of the form (from footer like "PAGE 1 OF 17")

pageRole: What type of page this is (read the title/header)
  "main_contract" = primary purchase agreement
  "counter_offer" = any counter offer (SCO, BCO, etc.)
  "addendum" = addenda/amendments
  "signatures" = signature blocks
  "broker_info" = agent contact info

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIELD EXTRACTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Extract ANY fields visible on this page:

**PROPERTY ADDRESS** - Look at the TOP of the page first:
- In header tables or labeled "Property:", "Property Address:", "Subject Property:"
- Format: "123 Main Street, Los Angeles, CA 90210"
- Appears on counter offers, addenda, and main contracts
- Only return null if page has zero property references

Other header fields:
- Buyer Names: Full names
- Seller Names: Full names (may only be on signature pages)

Body fields:
- Purchase Price / Sales Price / Contract Price
- Earnest Money / Initial Deposit / Deposit
- Closing Date / Close of Escrow / Settlement Date (date or "X days")
- Financing: All Cash checkbox, Loan Type (Conventional/FHA/VA/etc)
- Contingencies: Inspection days, Appraisal days, Loan days
- Brokers: Agent names and brokerage firms

**SIGNATURE DATES** - CRITICAL for determining contract acceptance:
- buyerSignatureDates: Extract ALL buyer signature dates visible on THIS page
  * Look for signature blocks labeled "Buyer", "Purchaser", or buyer names
  * Extract date EXACTLY as written: "1/15/24", "01-15-2024", "January 15, 2024"
  * DO NOT normalize format - we need the literal text
  * If multiple buyers signed, include all dates (even if same date)
  * Return null if no buyer signatures on this page
  * IGNORE agent/broker signatures - only buyer signatures matter

- sellerSignatureDates: Extract ALL seller signature dates visible on THIS page
  * Look for signature blocks labeled "Seller", "Vendor", or seller names
  * Extract date EXACTLY as written: "1/10/24", "01-10-2024", "January 10, 2024"
  * DO NOT normalize format - we need the literal text
  * If multiple sellers signed, include all dates (even if same date)
  * Return null if no seller signatures on this page
  * IGNORE agent/broker signatures - only seller signatures matter

SPECIAL NOTES:
- Purchase Price = 0 is an ERROR. If unclear, return null.
- If unclear, return null for optional fields.
- Dates: Return as-is ("45 days" or "2025-12-31" or 45)
- Seller names often only appear on signature pages, not page 1
- Signature dates are usually near signature lines - look for "Date:" or "Dated:" labels
- Counter offer acceptance dates are also signature dates - extract them

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Return a JSON array with one object per image, matching this schema:

${schemaString}

No explanatory text. No markdown. Just the JSON array.
`.trim();
}

export const UNIVERSAL_EXTRACTOR_PROMPT = buildUniversalExtractorPrompt;