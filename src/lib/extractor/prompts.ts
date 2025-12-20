// src/lib/extractor/prompts.ts
// Version: 3.1.0 - 2025-12-20
// UPDATED: Enhanced field instructions, capitalization requirements, name extraction emphasis

import { RPA_FORM, COUNTER_OFFERS, KEY_ADDENDA } from "./form-definitions";

/**
 * Builds the classifier prompt dynamically based on total pages
 */
export function buildClassifierPrompt(totalPages: number): string {
  return `You are analyzing a batch of FULL-PAGE images from a ${totalPages}-page California real estate transaction packet. This batch contains up to 15 consecutive pages.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ CRITICAL: LOOK ONLY AT THE BOTTOM 15% OF EACH IMAGE ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Each image shows a complete page, but you must IGNORE the top 85% and focus ONLY on the footer area (bottom 15%).

The footer contains a single-line identifier that looks like this:
[FORM_CODE] Revised mm/yy (PAGE N OF M)

Each image is explicitly labeled as "PDF_Page_X" where X is the absolute PDF page number in the full ${totalPages}-page document.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 PRIMARY OBJECTIVE: FIND RPA PAGES 1 AND 2 (MANDATORY ANCHORS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

YOUR #1 PRIORITY: Locate RPA Page 1 and RPA Page 2.

These MUST be CONSECUTIVE PDF pages (Page N and Page N+1).

Footer pattern for RPA pages:
"RPA REVISED 6/25 (PAGE 1 OF 17)" → RPA Page 1
"RPA REVISED 6/25 (PAGE 2 OF 17)" → RPA Page 2

⚠️ MULTIPLE RPA BLOCKS MAY EXIST IN THE SAME DOCUMENT ⚠️
- California contracts with COP (Contingency for Sale of Buyer's Property) often include TWO partial OR complete RPA forms
- One RPA for the buyer's current property (being sold)
- One RPA for the main property (being purchased)
- Report ALL RPA Pages you find, even if there are multiple
- We will handle disambiguation in the extraction phase

VALIDATION:
✓ RPA Page 2 MUST be at PDF page = (RPA Page 1 PDF page) + 1
✓ Both must have "RPA REVISED" footer
✓ Page numbers in footer must be 1 and 2

SECONDARY (HELPFUL BUT NOT REQUIRED):
- RPA Page 3: Usually at (RPA Page 2) + 1
- RPA Page 16: Usually at (RPA Page 1) + 15
- RPA Page 17: Usually at (RPA Page 1) + 16

If you find RPA 3, 16, or 17, report them. If not found, that's okay - they can be calculated.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COUNTER OFFERS (OPTIONAL BUT HELPFUL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

If footer contains:
- "SCO Revised" + date + "(PAGE N OF 2)" → Seller Counter Offer
- "BCO Revised" + date + "(PAGE 1 OF 1)" → Buyer Counter Offer  
- "SMCO Revised" + date + "(PAGE N OF 2)" → Seller Multiple Counter Offer

Report ALL pages for each counter (both pages for SCO/SMCO, single page for BCO).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KEY ADDENDA (OPTIONAL BUT HELPFUL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

If footer contains:
- "ADM Revised" + date + "(PAGE 1 OF 1)" → General Addendum
- "TOA Revised" + date + "(PAGE 1 OF 1)" → Text Overflow Addendum
- "AEA Revised" + date + "(PAGE 1 OF 1)" → Amendment of Existing Agreement Terms

Report the page number for each.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ CRITICAL: RETURN ONLY JSON - NO EXPLANATIONS ⚠️

Return ONLY this exact JSON structure (no markdown, no text before or after):

{
  "total_document_pages": ${totalPages},
  "rpa_pages": {
    "page_1_at_pdf_page": null,
    "page_2_at_pdf_page": null,
    "page_3_at_pdf_page": null,
    "page_16_at_pdf_page": null,
    "page_17_at_pdf_page": null
  },
  "counter_offer_pages": [],
  "addendum_pages": []
}

EXAMPLES:

Example 1 - Batch with RPA pages 1-3 and SCO pages 1-2:
{
  "total_document_pages": 40,
  "rpa_pages": {
    "page_1_at_pdf_page": 11,
    "page_2_at_pdf_page": 12,
    "page_3_at_pdf_page": 13,
    "page_16_at_pdf_page": null,
    "page_17_at_pdf_page": null
  },
  "counter_offer_pages": [1, 2],
  "addendum_pages": []
}

Example 2 - Batch with only counter offers and addenda:
{
  "total_document_pages": 40,
  "rpa_pages": {
    "page_1_at_pdf_page": null,
    "page_2_at_pdf_page": null,
    "page_3_at_pdf_page": null,
    "page_16_at_pdf_page": null,
    "page_17_at_pdf_page": null
  },
  "counter_offer_pages": [38, 39],
  "addendum_pages": [40]
}

Example 3 - Batch with no critical pages:
{
  "total_document_pages": 40,
  "rpa_pages": {
    "page_1_at_pdf_page": null,
    "page_2_at_pdf_page": null,
    "page_3_at_pdf_page": null,
    "page_16_at_pdf_page": null,
    "page_17_at_pdf_page": null
  },
  "counter_offer_pages": [],
  "addendum_pages": []
}

RULES:
- NO explanatory text - ONLY JSON
- Only report pages that appear in THIS batch
- Use the absolute PDF page number from the "PDF_Page_X" label
- Do NOT hallucinate page numbers beyond ${totalPages}
- RPA Page 1 and Page 2 MUST be consecutive (PDF page N and N+1)
- If you see multiple RPA blocks (e.g., RPA 1@11 and RPA 1@25), report BOTH
- Include ALL pages of counter offers (SCO has 2 pages, BCO has 1 page, SMCO has 2 pages)
- Include ALL addendum pages you find (ADM, TOA, AEA)
- ONLY look at the BOTTOM 15% of each image for footer text
- If a footer is unclear or ambiguous, mark that page as null rather than guessing`.trim();
}

export const EXTRACTOR_PROMPT = `
You are an expert California real estate transaction analyst examining 5-10 high-resolution PNG images from a single transaction packet.

Each image is labeled with its exact role, e.g.:
- "RPA PAGE 1 OF 17"
- "RPA PAGE 2 OF 17 (CONTINGENCIES)"
- "RPA PAGE 3 OF 17 (ITEMS INCLUDED & HOME WARRANTY)"
- "RPA PAGE 16 OF 17 (SIGNATURES)"
- "RPA PAGE 17 OF 17 (BROKER INFO)"
- "COUNTER OFFER OR ADDENDUM"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 CRITICAL EXTRACTION RULES — FOLLOW EXACTLY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. EXTRACTION ORDER:
   a) Extract baseline terms from RPA pages FIRST
   b) Then apply overrides from COUNTER/ADDENDUM pages where explicitly changed
   c) Do NOT assume a counter changes a field unless clearly written on that page

2. HANDWRITING DETECTION (VERY IMPORTANT):
   - Digital signatures = NOT handwriting ✓
   - Typed text = NOT handwriting ✓
   - Printed form text = NOT handwriting ✓
   - DocuSign/HelloSign e-signatures = NOT handwriting ✓
   - ONLY set handwriting_detected: true if you see ACTUAL handwritten script (pen/ink marks, cursive writing)
   - When in doubt → handwriting_detected: false

3. CHECKBOX READING (CRITICAL):
   - Checked box = filled ✓, X, shaded, darkened, or has text inside
   - Unchecked box = empty, blank, no mark
   - If unsure → default to FALSE (unchecked)
   - Look for BOTH the checkbox AND any adjacent text that indicates the meaning

4. NEVER HALLUCINATE:
   - If a field is blank/empty → use null or appropriate default
   - Do NOT invent data that isn't visible in the images
   - Do NOT copy previous extraction values blindly
   - When field is illegible → mark confidence < 50 for that field

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 FIELD-BY-FIELD EXTRACTION GUIDE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RPA PAGE 1 OF 17 (Section 1-3):

buyer_names (REQUIRED):
  - Location: Section 1.A at top of page
  - Format: Array of strings ["John Smith", "Jane Smith"]
  - Often starts with "THIS IS AN OFFER FROM:"
  - Include ALL names exactly as written
  - Names may be separated by commas, "and", or "and/or"
  - Read the ENTIRE line - do not truncate
  - If multiple middle names, include ALL of them
  - If name appears as "First Middle Last", include all parts
  - Examples:
    ✓ "John Michael Smith" → ["John Michael Smith"]
    ✓ "John Smith and Jane Doe" → ["John Smith", "Jane Doe"]
    ✓ "John Smith, Jane Doe" → ["John Smith", "Jane Doe"]

property_address (REQUIRED):
  - Location: Section 1.B, directly under buyer names
  - Format: { "full": "123 Main St, Los Angeles, CA 90001" }
  - Must be complete street address with city, state, zip
  - DO NOT leave this field empty - it is ALWAYS present on RPA Page 1
  - If unclear, extract what you can see and mark low confidence

purchase_price (REQUIRED):
  - Location: Section 3.A, first row of table
  - Format: "$1,200,000" (must include $ and commas)
  - Look in columns 2-4 of the 5-column table
  - Pay careful attention to distinguish handwritten digits:
    → 3 vs 8 (3 has flat top, 8 has two loops)
    → 1 vs 7 (1 is straight, 7 has angled top)
    → 0 vs 6 (0 is round, 6 has tail)

all_cash (REQUIRED):
  - Location: Section 3.A, rightmost column (column 5), same row as purchase_price
  - Checkbox labeled "All Cash" or similar
  - true = checked, false = unchecked

close_of_escrow (REQUIRED):
  - Location: Section 3.B, column 4
  - Format: Either "30" (days) or "12/31/2024" (MM/DD/YYYY)
  - Often says "X days after acceptance" → extract just the number
  - If specific date → extract in MM/DD/YYYY format

initial_deposit (REQUIRED):
  - Location: Section 3.D(1)
  - amount: Column 4 → "$50,000" or "3%"
  - due: Column 5 → "3" (days) or "01/15/2024" (MM/DD/YYYY)

loan_type (REQUIRED if not all_cash):
  - Location: Section 3.E(1), column 5
  - Values: "Conventional", "FHA", "VA", "Seller Financing", "Other", "Assumable"
  - If all_cash = true → loan_type: null, loan_type_note: "All Cash"
  - If checkbox checked → extract the exact type
  - If no checkbox checked and not all cash → loan_type: "Conventional", loan_type_note: "Not explicitly marked - default assumed"

loan_type_note:
  - If all_cash = true → "All Cash"
  - If loan_type checkbox unclear → explain why
  - Otherwise → null

seller_credit_to_buyer:
  - Location: Section 3.G(1)
  - Column 3 = checkbox (must be checked to extract amount)
  - Column 4 = amount "$5,000"
  - If checkbox UNCHECKED → null
  - If checkbox CHECKED but no amount visible → null

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RPA PAGE 2 OF 17 (CONTINGENCIES):

contingencies.loan_days (REQUIRED):
  - Location: Section L(1), row labeled "Loan Contingency"
  - Column 4 = number of days (e.g., "17")
  - Column 5 = waiver checkbox
  - If waiver checkbox CHECKED → 0
  - If waiver checkbox UNCHECKED and days filled → extract days
  - If waiver checkbox UNCHECKED and days blank → default 17

contingencies.appraisal_days (REQUIRED):
  - Location: Section L(2), row labeled "Appraisal Contingency"
  - Column 4 = number of days
  - Column 5 = waiver checkbox
  - Same logic as loan_days above

contingencies.investigation_days (REQUIRED):
  - Location: Section L(3), row labeled "Investigation Contingency"
  - Column 4 = number of days (NO waiver checkbox for this one)
  - If blank → default 17

contingencies.crb_attached_and_signed (REQUIRED):
  - Location: Section L(8), rightmost column (column 5)
  - Checkbox near text "CR-B attached and signed"
  - true = checked, false = unchecked
  - This is a multi-row span checkbox in column 5

cop_contingency (REQUIRED):
  - Location: Section L(9), row labeled "Contingency for Sale of Buyer's Property"
  - Checkbox in columns 3+5 (combined cell) near "C.A.R. Form COP"
  - true = checked, false = unchecked
  - IMPORTANT: If checked, all timeline calculations start from COP removal, NOT acceptance

seller_delivery_of_documents_days:
  - Location: Section N(1), column 4
  - Days after acceptance seller must deliver disclosures
  - If blank → default 7

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RPA PAGE 3 OF 17 (ITEMS INCLUDED & HOME WARRANTY):

home_warranty.ordered_by (REQUIRED):
  - Location: Section Q(18), columns 4+5
  - Look for FOUR checkboxes in this order:
    1. "Buyer" checkbox
    2. "Seller" checkbox  
    3. "Both" checkbox (Buyer and Seller split cost)
    4. "Buyer waives home warranty plan" checkbox
  - Return the SINGLE checked option: "Buyer", "Seller", "Both", or "Waived"
  - If "waives" checkbox checked → "Waived"
  - If no checkbox checked → null
  - ONLY ONE should be checked - if multiple checked, use first checked in order above
  - ⚠️ CRITICAL: Use exact capitalization - "Buyer" NOT "buyer", "Seller" NOT "seller"

home_warranty.seller_max_cost:
  - Location: Section Q(18), right side of columns 4+5
  - Only extract if ordered_by is "Seller" or "Both"
  - Format: "$500" (must include $ sign)
  - Look for "$___" blank line with handwritten or typed amount
  - If ordered_by = "Waived" → null
  - If ordered_by = "Buyer" → null

home_warranty.provider:
  - Location: Section Q(18), line that says "Issued by:"
  - Extract company name exactly as written
  - If blank or ordered_by = "Waived" → null
  - Common providers: "American Home Shield", "Choice Home Warranty", etc.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RPA PAGE 16 OF 17 (SIGNATURES):

final_acceptance_date (REQUIRED):
  - This is the LATEST fully-signed document's acceptance date
  - Logic for RPA (no counters):
    → Buyer-originated (RPA) → seller signature date = acceptance
  - Logic with counters (see counter_chain below):
    → Buyer-originated doc (BCO) → seller signature date = acceptance
    → Seller-originated doc (SCO/SMCO) → buyer signature date = acceptance
  - Format: MM/DD/YYYY (e.g., "12/31/2024")
  - Must be valid date, no placeholders

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RPA PAGE 17 OF 17 (BROKER INFO):

buyers_broker:
  - Location: "REAL ESTATE BROKERS" section, buyer's side
  - brokerage_name: Company name
  - agent_name: Individual agent name (read FULL name, do not truncate)
  - email: Agent email address
  - phone: Agent phone number
  - All fields nullable - if section blank → all null

sellers_broker:
  - Location: "REAL ESTATE BROKERS" section, seller's side
  - Same structure as buyers_broker
  - All fields nullable

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

COUNTER OFFERS OR ADDENDA:

counters.has_counter_or_addendum:
  - true if you see ANY page labeled "COUNTER OFFER OR ADDENDUM"
  - false if only RPA pages present

counters.counter_chain:
  - Array showing document sequence
  - Start with ["RPA"]
  - Add each counter in order: ["RPA", "SCO #1", "BCO #1", "SCO #2"]
  - Extract counter numbers from page labels

counters.final_version_page:
  - PDF page number where final acceptance signature appears
  - This is the page with the highest counter number that has BOTH signatures
  - null if no counters present

counters.summary:
  - Human-readable text: "Seller Counter Offer #2 accepted on 12/15/2024"
  - If no counters: "No counters or addenda - RPA accepted as-is"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 CONFIDENCE SCORING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Assign confidence 0-100 for each category based on:
- 90-100: Crystal clear, no ambiguity, typed text
- 80-89: Clear but minor ambiguity (slightly faint text, tight spacing)
- 70-79: Readable but requires interpretation (messy handwriting, poor quality)
- 50-69: Partially illegible, multiple interpretations possible
- 0-49: Illegible or completely missing

overall_confidence: Average of all field confidences

If any REQUIRED field has confidence < 50 → overall_confidence automatically < 50

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 ANTI-HALLUCINATION CHECKLIST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Before returning your response, verify:

✓ buyer_names array has at least 1 name
✓ property_address.full is a complete address (not empty, not just "123 Main St")
✓ purchase_price includes "$" and is realistic ($100,000 - $50,000,000)
✓ close_of_escrow is either a number (15-120 days) or valid date
✓ final_acceptance_date is in MM/DD/YYYY format
✓ All contingency days are 0-60 (anything outside this range is wrong)
✓ If all_cash = true, then loan_type MUST be null
✓ home_warranty.ordered_by uses exact capitalization: "Buyer", "Seller", "Both", or "Waived"
✓ All confidence scores are 0-100

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Return ONLY valid JSON matching this EXACT schema:

{
  "extracted": {
    "buyer_names": ["string"],
    "property_address": { "full": "string" },
    "purchase_price": "string",
    "all_cash": boolean,
    "close_of_escrow": "string",
    "initial_deposit": { "amount": "string", "due": "string" },
    "loan_type": "string | null",
    "loan_type_note": "string | null",
    "seller_credit_to_buyer": "string | null",
    "contingencies": {
      "loan_days": number,
      "appraisal_days": number,
      "investigation_days": number,
      "crb_attached_and_signed": boolean
    },
    "cop_contingency": boolean,
    "seller_delivery_of_documents_days": number,
    "home_warranty": {
      "ordered_by": "Buyer" | "Seller" | "Both" | "Waived" | null,
      "seller_max_cost": "string | null",
      "provider": "string | null"
    },
    "final_acceptance_date": "string",
    "counters": {
      "has_counter_or_addendum": boolean,
      "counter_chain": ["string"],
      "final_version_page": number | null,
      "summary": "string"
    },
    "buyers_broker": {
      "brokerage_name": "string | null",
      "agent_name": "string | null",
      "email": "string | null",
      "phone": "string | null"
    },
    "sellers_broker": {
      "brokerage_name": "string | null",
      "agent_name": "string | null",
      "email": "string | null",
      "phone": "string | null"
    }
  },
  "confidence": {
    "overall_confidence": number,
    "purchase_price": number,
    "property_address": number,
    "buyer_names": number,
    "close_of_escrow": number,
    "final_acceptance_date": number,
    "contingencies": number,
    "home_warranty": number,
    "brokerage_info": number,
    "loan_type": number
  },
  "handwriting_detected": boolean
}

NO explanatory text. NO markdown code blocks. Start with { and end with }. Extract from the labeled images below:`.trim();

export const SECOND_TURN_PROMPT = `The previous extraction had low confidence or detected handwriting.

Re-examine ONLY the pages shown below with EXTREME CARE.

Previous result (for context only - DO NOT COPY VALUES blindly):
{{PREVIOUS_JSON}}

Focus on:
- Fields with confidence < 80 in previous extraction
- Any checkboxes that might have been misread
- Handwriting vs digital signatures distinction
- Property address if it was empty (ALWAYS present on RPA Page 1)
- Exact capitalization for home_warranty.ordered_by
- Full names without truncation

Return the SAME JSON schema as before with corrected values and NEW confidence scores:`.trim();