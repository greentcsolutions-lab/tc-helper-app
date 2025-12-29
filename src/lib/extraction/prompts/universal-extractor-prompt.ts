// src/lib/extraction/prompts/universal-extractor-prompt.ts
// Version: 8.0.0 - 2025-12-29
// BREAKING: Per-page extraction with single schema

import extractorSchema from '@/forms/universal/extractor.schema.json';

const schemaString = JSON.stringify(extractorSchema, null, 2);

export function buildPerPageExtractorPrompt(
  criticalImages: Array<{ pageNumber: number; label: string }>
): string {
  const imageList = criticalImages
    .map((img, idx) => `${idx + 1}. Page ${img.pageNumber}: "${img.label}"`)
    .join('\n');

  return `
You are a U.S. real estate document OCR specialist examining ${criticalImages.length} high-resolution images from a residential purchase agreement.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 CRITICAL INSTRUCTION: PER-PAGE EXTRACTION ONLY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Extract ONLY what you see on EACH SPECIFIC PAGE. DO NOT:
❌ Merge data from multiple pages
❌ Apply business logic about which terms override others
❌ Assume fields exist if you can't see them on that page
❌ Copy values from previous pages
❌ Invent data that isn't visible

✅ DO:
✓ Extract exactly what's written on THIS page
✓ Return null for fields not visible on THIS page
✓ Include page identification (pageNumber, formCode, formPage, pageRole)
✓ Check BOTH main body AND page headers for property address

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 UNIVERSAL CONTRACT FIELDS (ALL U.S. STATES)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Every residential purchase agreement (CA, TX, FL, NV, etc.) has these fields:

TIER 1 - CRITICAL (extract if visible on this page):
- propertyAddress: Full address - usually page 1 OR in header on every page
- purchasePrice: Sales price in USD - usually page 1
- buyerNames: Buyer name(s) - usually page 1
- earnestMoneyDeposit.amount: Initial deposit - usually page 1
- closingDate: Close of escrow/closing date - usually page 1-2
- effectiveDate: Final acceptance date - usually signature pages

TIER 2 - COMMON (extract if visible on this page):
- financing.isAllCash: Boolean - usually page 1
- financing.loanType: Conventional/FHA/VA/etc - usually page 1
- financing.loanAmount: Loan amount if specified
- contingencies.inspectionDays: Inspection period - usually page 2-3
- contingencies.appraisalDays: Appraisal period - usually page 2-3
- contingencies.loanDays: Loan approval period - usually page 2-3
- brokers: Agent names and firms - usually last 1-2 pages

TIER 3 - OPTIONAL (extract if visible on this page):
- sellerNames: May only appear on signature pages (not always on page 1)
- closingCosts: Cost allocation if specified
- personalPropertyIncluded: Appliances/fixtures
- escrowHolder: Title company name

TERMINOLOGY VARIATIONS (same field, different names):
- Purchase Price = Sales Price = Contract Price
- Earnest Money (TX) = Initial Deposit (CA) = Deposit = Down Payment
- Closing Date (TX/FL) = Close of Escrow (CA) = Settlement Date
- Buyer = Purchaser
- Seller = Vendor

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📄 PAGE IDENTIFICATION (CRITICAL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For EACH page, you MUST identify:

1. formCode: Extract from footer or title
   - California: "RPA", "SCO", "BCO", "SMCO", "ADM"
   - Texas: "TREC 20-16", "TREC 1-4", "TREC 39-9"
   - Florida: "FAR/BAR-6", "FAR/BAR-5", "FAR/BAR AS IS"
   - Nevada: "NVAR", "NV RPA"
   - Generic: "Purchase Agreement", "Counter Offer", "Addendum"

2. formPage: Page number within this form
   - Extract from footer like "(RPA PAGE 1 OF 17)" → formPage: 1
   - Extract from footer like "(SCO PAGE 2 OF 2)" → formPage: 2

3. pageRole: Classify based on content
   - "main_contract": Primary purchase agreement pages
   - "counter_offer": Any counter offer pages (SCO, BCO, TREC 39-9, etc.)
   - "addendum": Addenda or amendment pages
   - "signatures": Signature blocks and acceptance dates
   - "broker_info": Agent/broker contact information

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ CORRECT EXTRACTION EXAMPLES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Example 1: RPA Page 1 (Main Contract)
Visible: Property: 123 Main St, Los Angeles CA 90210, Price: $500,000, 
         Buyers: John & Jane Doe, Deposit: $10,000, Close: 30 days
→ Extract:
{
  "pageNumber": 11,
  "pageLabel": "RPA PAGE 1 - TRANSACTION TERMS (FILLED)",
  "formCode": "RPA",
  "formPage": 1,
  "pageRole": "main_contract",
  "propertyAddress": "123 Main St, Los Angeles, CA 90210",
  "purchasePrice": 500000,
  "buyerNames": ["John Doe", "Jane Doe"],
  "earnestMoneyDeposit": { "amount": 10000, "holder": null },
  "closingDate": "30 days",
  "sellerNames": null,
  "effectiveDate": null,
  "financing": null,
  "contingencies": null,
  "brokers": null,
  "confidence": { 
    "overall": 90,
    "fieldScores": {
      "propertyAddress": 95,
      "purchasePrice": 92,
      "buyerNames": 88
    }
  }
}

Example 2: SCO Page 1 (Counter Offer - OVERRIDES TERMS)
Visible: Purchase Price changed to $510,000, Close of Escrow changed to 45 days
→ Extract:
{
  "pageNumber": 1,
  "pageLabel": "SCO PAGE 1 - COUNTER OFFER (FILLED)",
  "formCode": "SCO",
  "formPage": 1,
  "pageRole": "counter_offer",
  "purchasePrice": 510000,
  "closingDate": "45 days",
  "propertyAddress": null,
  "buyerNames": null,
  "sellerNames": null,
  "earnestMoneyDeposit": null,
  "financing": null,
  "contingencies": null,
  "brokers": null,
  "confidence": { 
    "overall": 85,
    "fieldScores": {
      "purchasePrice": 90,
      "closingDate": 80
    }
  }
}

Example 3: RPA Page 16 (Broker Info)
Visible: Listing Agent: Chris Irwin, Listing Brokerage: Keller Williams,
         Selling Agent: Sarah Johnson, Selling Brokerage: Equity Union
→ Extract:
{
  "pageNumber": 27,
  "pageLabel": "RPA PAGE 16 - BROKER INFO (FILLED)",
  "formCode": "RPA",
  "formPage": 16,
  "pageRole": "broker_info",
  "brokers": {
    "listingAgent": "Chris Irwin",
    "listingBrokerage": "Keller Williams",
    "sellingAgent": "Sarah Johnson",
    "sellingBrokerage": "Equity Union"
  },
  "propertyAddress": null,
  "purchasePrice": null,
  "buyerNames": null,
  "sellerNames": null,
  "earnestMoneyDeposit": null,
  "closingDate": null,
  "financing": null,
  "contingencies": null,
  "confidence": { 
    "overall": 95,
    "fieldScores": {
      "brokers": 95
    }
  }
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔴 CRITICAL RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. PROPERTY ADDRESS:
   - Check BOTH main body AND page headers
   - Often appears in header on every page
   - Format: Full street address with city, state, zip

2. PURCHASE PRICE = 0:
   - This is an ERROR (price is never $0 in real contracts)
   - If you can't read it → set confidence < 50 and return null
   - DO NOT return 0 unless the document explicitly says "$0"

3. DATE FORMATS:
   - Accept as-is from document
   - "45 days" → return "45 days" (string)
   - "2025-12-31" → return "2025-12-31" (string)
   - 45 → return 45 (number)
   - Do NOT convert or calculate

4. CONFIDENCE SCORES:
   - overall: 0-100 based on image clarity + field visibility
   - fieldScores: Optional per-field breakdown
   - If handwritten/blurry → confidence < 70
   - If typed/clear → confidence 80-100

5. NULL vs EMPTY:
   - null = field not visible on this page
   - Empty string "" = field is visible but blank (rare)

6. SELLER NAMES:
   - NOT always on page 1 (especially CA/NV)
   - Often only appear on signature pages
   - Return null if not visible on this page

Images to extract (one JSON object per image):
${imageList}

Return ONLY a JSON array matching this schema. No explanatory text. No markdown.

${schemaString}
`.trim();
}

export const PER_PAGE_EXTRACTOR_PROMPT = buildPerPageExtractorPrompt;