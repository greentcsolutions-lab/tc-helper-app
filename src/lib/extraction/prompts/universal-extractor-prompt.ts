// src/lib/extraction/prompts/universal-extractor-prompt.ts
// Version: 11.0.0 - 2025-12-30
// BREAKING: Removed verbose schema embedding, using minimal example (matches manual test)

/**
 * Builds universal extractor prompt with minimal example structure
 * Instead of embedding 2000+ char schema, shows concise example
 * Matches manual Grok test approach where schema was attached as file
 */
export function buildUniversalExtractorPrompt(
  criticalImages: Array<{ pageNumber: number; label: string }>
): string {
  
  // Minimal example showing structure only (not verbose descriptions)
  const exampleObject = {
    pageNumber: 1,
    pageLabel: "RPA PAGE 1 OF 17",
    formCode: "RPA",
    formPage: 1,
    pageRole: "main_contract",
    buyerNames: ["John Doe"],
    sellerNames: ["Jane Smith"],
    propertyAddress: "123 Main Street, Los Angeles, CA 90210",
    purchasePrice: 500000,
    earnestMoneyDeposit: {
      amount: 5000,
      holder: "Title Company"
    },
    closingDate: "2025-12-31",
    financing: {
      isAllCash: false,
      loanType: "Conventional",
      loanAmount: 400000
    },
    contingencies: {
      inspectionDays: 17,
      appraisalDays: 17,
      loanDays: 21,
      saleOfBuyerProperty: false
    },
    closingCosts: {
      buyerPays: ["title insurance", "escrow fees"],
      sellerPays: ["transfer tax"],
      sellerCreditAmount: null
    },
    brokers: {
      listingBrokerage: "ABC Realty",
      listingAgent: "Jane Agent",
      sellingBrokerage: "XYZ Realty",
      sellingAgent: "John Agent"
    },
    personalPropertyIncluded: ["refrigerator", "washer", "dryer"],
    effectiveDate: "2025-10-15",
    escrowHolder: "Chicago Title",
    confidence: {
      overall: 95,
      fieldScores: {
        propertyAddress: 90,
        purchasePrice: 100
      }
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

Return a JSON array with one object per image.

Example structure (extract what you see, use null if not visible):

${JSON.stringify([exampleObject], null, 2)}

No explanatory text. No markdown. Just the JSON array.
`.trim();
}

export const UNIVERSAL_EXTRACTOR_PROMPT = buildUniversalExtractorPrompt;