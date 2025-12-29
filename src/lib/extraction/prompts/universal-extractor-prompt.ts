// src/lib/extraction/prompts/universal-extractor-prompt.ts
// Version: 9.0.0 - 2025-12-29
// BREAKING: Pure OCR extraction - no semantic labels, no context pollution
// Grok extracts what it sees on each page. Post-processor handles merging.

import extractorSchema from '@/forms/universal/extractor.schema.json';

const schemaString = JSON.stringify(extractorSchema, null, 2);

export function buildPerPageExtractorPrompt(
  criticalImages: Array<{ pageNumber: number; label: string }>
): string {
  return `You are a document OCR specialist. Extract data from ${criticalImages.length} real estate contract page images.

Your job: Extract EXACTLY what you see on each page. Nothing more, nothing less.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Extract from ENTIRE page (headers + body + footers)
2. Property address often appears in page HEADER - extract it
3. Return null ONLY if field is truly not visible anywhere on the page
4. DO NOT skip header fields - they contain real data
5. DO NOT make assumptions about what "should" be on a page
6. DO NOT apply business logic about overrides or changes

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

COMMON HEADER FIELDS (check top of page):
- Property Address: Full address (street, city, state, zip)
- Buyer Names: Full names
- Seller Names: Full names (may only be on signature pages)

COMMON BODY FIELDS (check main content):
- Purchase Price / Sales Price / Contract Price
- Earnest Money / Initial Deposit / Deposit
- Closing Date / Close of Escrow / Settlement Date (date or "X days")
- Financing: All Cash checkbox, Loan Type (Conventional/FHA/VA/etc)
- Contingencies: Inspection days, Appraisal days, Loan days
- Brokers: Agent names and brokerage firms

SPECIAL NOTES:
- Purchase Price = 0 is an ERROR. If unclear, return null.
- Dates: Return as-is ("45 days" or "2025-12-31" or 45)
- Seller names often only appear on signature pages, not page 1

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXAMPLES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Example: RPA Page 1
HEADER: Property: 123 Main St, Los Angeles, CA 90210 | Buyers: John Doe, Jane Doe
BODY: Purchase Price: $500,000, Deposit: $10,000, Close: 30 days
FOOTER: (RPA PAGE 1 OF 17)

Extract:
{
  "pageNumber": 11,
  "pageLabel": "RPA PAGE 1 OF 17",
  "formCode": "RPA",
  "formPage": 1,
  "pageRole": "main_contract",
  "propertyAddress": "123 Main St, Los Angeles, CA 90210",
  "purchasePrice": 500000,
  "buyerNames": ["John Doe", "Jane Doe"],
  "earnestMoneyDeposit": { "amount": 10000, "holder": null },
  "closingDate": "30 days",
  "sellerNames": null,
  "financing": null,
  "contingencies": null,
  "brokers": null,
  "confidence": { "overall": 90 }
}

Example: SCO Page 1 (Counter Offer)
HEADER: Property: 123 Main St, Los Angeles, CA 90210
BODY: Purchase Price changed to $510,000, Close of Escrow changed to 21 days
FOOTER: (SCO PAGE 1 OF 2)

Extract:
{
  "pageNumber": 1,
  "pageLabel": "SCO PAGE 1 OF 2",
  "formCode": "SCO",
  "formPage": 1,
  "pageRole": "counter_offer",
  "propertyAddress": "123 Main St, Los Angeles, CA 90210",
  "purchasePrice": 510000,
  "closingDate": "21 days",
  "buyerNames": null,
  "sellerNames": null,
  "earnestMoneyDeposit": null,
  "financing": null,
  "contingencies": null,
  "brokers": null,
  "confidence": { "overall": 85 }
}

NOTE: Both examples extract property address from header. SCO shows changed price.
Post-processor will merge: final price = $510k (SCO overrides RPA).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Return a JSON array with one object per image, matching this schema:

${schemaString}

No explanatory text. No markdown. Just the JSON array.
`.trim();
}

export const PER_PAGE_EXTRACTOR_PROMPT = buildPerPageExtractorPrompt;