// src/lib/extraction/prompts/universal-extractor-prompt.ts
// Version: 12.0.0 - 2025-12-30
// BREAKING: Using streamlined schema with concise descriptors (matches manual test intent)

/**
 * Builds universal extractor prompt with streamlined schema
 * Includes field-level guidance without verbose bloat
 */
export function buildUniversalExtractorPrompt(
  criticalImages: Array<{ pageNumber: number; label: string }>
): string {
  
  // Streamlined schema with concise, actionable descriptors
  const schema = {
    pageNumber: "integer (PDF page number)",
    pageLabel: "string (extracted from page header/footer, e.g. 'RPA PAGE 1 OF 17')",
    formCode: "string (form ID from footer/header: RPA, SCO, BCO, TREC, FAR/BAR, etc.)",
    formPage: "integer or null (page number within form, e.g. 1 of 17)",
    pageRole: "enum: main_contract | counter_offer | addendum | signatures | broker_info",
    
    // Critical fields - check headers first
    buyerNames: "array of strings or null (full names as written)",
    sellerNames: "array of strings or null (full names, often only on signature pages)",
    propertyAddress: "string or null (CRITICAL - check page header/top section first. Format: 'Street, City, ST ZIP')",
    
    // Transaction terms
    purchasePrice: "number or null (final price in USD. NEVER use 0 - use null if unclear)",
    earnestMoneyDeposit: {
      amount: "number or null (deposit amount in USD)",
      holder: "string or null (escrow/title company holding deposit)"
    },
    closingDate: "string, integer, or null (date as YYYY-MM-DD, or days like 45, or text like '45 days')",
    
    // Financing details
    financing: {
      isAllCash: "boolean or null (true if no loan)",
      loanType: "string or null (Conventional, FHA, VA, USDA, Other)",
      loanAmount: "number or null (loan amount in USD)"
    },
    
    // Contingencies
    contingencies: {
      inspectionDays: "integer, string, or null (days or 'Waived' or date)",
      appraisalDays: "integer, string, or null",
      loanDays: "integer, string, or null",
      saleOfBuyerProperty: "boolean or null (COP contingency present)"
    },
    
    // Cost allocation
    closingCosts: {
      buyerPays: "array of strings or null (e.g. ['title insurance', 'escrow'])",
      sellerPays: "array of strings or null",
      sellerCreditAmount: "number or null (seller concession in USD)"
    },
    
    // Agent info
    brokers: {
      listingBrokerage: "string or null (listing broker firm)",
      listingAgent: "string or null (listing agent name)",
      sellingBrokerage: "string or null (selling broker firm)",
      sellingAgent: "string or null (selling agent name)"
    },
    
    // Additional terms
    personalPropertyIncluded: "array of strings or null (appliances/fixtures included)",
    effectiveDate: "string or null (final acceptance date as YYYY-MM-DD from signature pages)",
    escrowHolder: "string or null (escrow or title company name)",
    
    // Confidence scoring
    confidence: {
      overall: "integer 0-100 (overall confidence for this page)",
      fieldScores: "object or null (optional per-field scores for low-confidence fields)"
    }
  };

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

SPECIAL NOTES:
- Purchase Price = 0 is an ERROR. If unclear, return null.
- If unclear, return null for optional fields.
- Dates: Return as-is ("45 days" or "2025-12-31" or 45)
- Seller names often only appear on signature pages, not page 1

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Return a JSON array with one object per image, matching this schema:

${JSON.stringify(schema, null, 2)}

No explanatory text. No markdown. Just the JSON array.
`.trim();
}

export const UNIVERSAL_EXTRACTOR_PROMPT = buildUniversalExtractorPrompt;