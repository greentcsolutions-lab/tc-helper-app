// src/lib/extraction/prompts/universal-extractor-prompt.ts
// Version: 12.0.0 - 2025-12-31
// CRITICAL UPDATE: Added explicit per-page independence instructions to prevent context bleeding

import extractorSchema from '@/forms/universal/extractor.schema.json';

const schemaString = JSON.stringify(extractorSchema, null, 2);

export function buildUniversalExtractorPrompt(
  criticalImages: Array<{ pageNumber: number; label: string }>
): string {
  return `You are a document OCR specialist. Extract data from ${criticalImages.length} real estate contract page images.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 CRITICAL: PER-PAGE INDEPENDENCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You will receive ${criticalImages.length} images. Extract data from EACH IMAGE INDEPENDENTLY.

FOR EACH IMAGE:
1. Look ONLY at that specific image
2. Extract ONLY what you see on that specific image
3. DO NOT reference any other images
4. DO NOT assume information from other pages
5. DO NOT copy data from previous images
6. If a field is not visible on this specific image → return null

Example workflow:
- IMAGE 1: Extract only what's visible on IMAGE 1
- IMAGE 2: Extract only what's visible on IMAGE 2 (forget IMAGE 1)
- IMAGE 3: Extract only what's visible on IMAGE 3 (forget IMAGE 1 and 2)
- ... continue for all ${criticalImages.length} images

CRITICAL: Return EXACTLY ${criticalImages.length} JSON objects in the array, one per image, in order.
Each object represents ONE PAGE ONLY - what you see on that specific page.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXTRACTION RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Extract from ENTIRE page (headers + body + footers)
2. **PROPERTY ADDRESS is in the page header on 95% of pages - look at the very top**
3. Return null ONLY if field is truly not visible anywhere on THIS SPECIFIC PAGE
4. DO NOT skip header fields - they contain real data
5. DO NOT make assumptions about what "should" be on a page
6. DO NOT apply business logic about overrides or changes
7. DO NOT normalize dates - extract EXACTLY as written
8. IGNORE agent/broker signatures - we only care about buyer and seller signatures

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIELD EXTRACTION (WHAT TO LOOK FOR ON EACH PAGE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Extract ANY fields visible on THIS SPECIFIC PAGE:

**PROPERTY ADDRESS** - Look at the TOP of the page first:
- In header tables or labeled "Property:", "Property Address:", "Subject Property:"
- Format: "123 Main Street, Los Angeles, CA 90210"
- Appears on counter offers, addenda, and main contracts
- Only return null if THIS PAGE has zero property references

Other header fields (if visible on THIS PAGE):
- Buyer Names: Full names
- Seller Names: Full names (may only be on signature pages)

Body fields (if visible on THIS PAGE):
- Purchase Price / Sales Price / Contract Price
- Earnest Money / Initial Deposit / Deposit
- Closing Date / Close of Escrow / Settlement Date (date or "X days")
- Financing: All Cash checkbox, Loan Type (Conventional/FHA/VA/etc)
- Contingencies: Inspection days, Appraisal days, Loan days
- Brokers: Agent names and brokerage firms
- Personal Property Included: Items staying with property

**SIGNATURE DATES** - CRITICAL for determining contract acceptance:
- buyerSignatureDates: Extract ALL buyer signature dates visible on THIS PAGE
  * Look for signature blocks labeled "Buyer", "Purchaser", or buyer names
  * Extract date EXACTLY as written: "1/15/24", "01-15-2024", "January 15, 2024"
  * DO NOT normalize format - we need the literal text
  * If multiple buyers signed on THIS PAGE, include all dates
  * Return null if no buyer signatures on THIS PAGE
  * IGNORE agent/broker signatures - only buyer signatures matter

- sellerSignatureDates: Extract ALL seller signature dates visible on THIS PAGE
  * Look for signature blocks labeled "Seller", "Vendor", or seller names
  * Extract date EXACTLY as written: "1/10/24", "01-10-2024", "January 10, 2024"
  * DO NOT normalize format - we need the literal text
  * If multiple sellers signed on THIS PAGE, include all dates
  * Return null if no seller signatures on THIS PAGE
  * IGNORE agent/broker signatures - only seller signatures matter

SPECIAL NOTES:
- Purchase Price = 0 is an ERROR. If unclear, return null.
- If unclear, return null for optional fields.
- Dates: Return as-is ("45 days" or "2025-12-31" or 45)
- Signature dates are usually near signature lines - look for "Date:" or "Dated:" labels
- Counter offer acceptance dates are also signature dates - extract them

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Return a JSON array with EXACTLY ${criticalImages.length} objects, one per image, in order.

Schema for each object:

${schemaString}

CRITICAL REMINDERS:
- Array must have EXACTLY ${criticalImages.length} objects
- Objects must be in the SAME ORDER as the images sent
- Each object represents ONE PAGE ONLY
- No explanatory text. No markdown. Just the JSON array.
`.trim();
}

export const UNIVERSAL_EXTRACTOR_PROMPT = buildUniversalExtractorPrompt;