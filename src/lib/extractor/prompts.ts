// src/lib/extractor/prompts.ts
// Version: 3.0.0 - 2025-12-20
// UPDATED: Emphasizes RPA 1-2 as critical anchors, others optional

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

// src/lib/extractor/prompts.ts (EXTRACTOR_PROMPT only)

export const EXTRACTOR_PROMPT = `You are analyzing 5-10 high-resolution images from a California real estate transaction packet.

Each image is explicitly labeled above it with its exact role:

- "RPA PAGE 1 OF 17" → main contract terms (buyer names, address, purchase price, deposit, close of escrow)
- "RPA PAGE 2 OF 17 (CONTINGENCIES)" → contingencies, seller credits, financing details
- "RPA PAGE 3 OF 17 (ITEMS INCLUDED & HOME WARRANTY)" → included/excluded items, allocation of costs, home warranty
- "RPA PAGE 16 OF 17 (SIGNATURES)" → signature dates (use latest date as final acceptance)
- "RPA PAGE 17 OF 17 (BROKER INFO)" → brokerage and agent details
- "COUNTER OFFER OR ADDENDUM" → these pages contain overrides to the main RPA

CRITICAL RULES:
1. Use the explicitly labeled RPA pages as the primary source for all fields.
2. Only apply changes from "COUNTER OFFER OR ADDENDUM" pages if they explicitly modify a field (e.g., new price, changed contingencies, added seller credit).
3. The final accepted terms come from the latest fully-signed document (highest counter number with both signatures, or main RPA if no valid counters).
4. If a field appears on multiple pages, prefer the value from the highest-numbered valid counter, otherwise use the main RPA value.
5. Always reference the label when deciding which page to read from.

Now extract the following fields using the labeled pages:

# BUYER NAMES & PROPERTY ADDRESS (RPA PAGE 1 OF 17)
- Buyer names: Top section 1.A "THIS IS AN OFFER FROM" → return as array of strings
- Property address: Section 1.B full-width field directly below buyer names → object with "full" key

# PURCHASE PRICE, DEPOSIT & CLOSE OF ESCROW (RPA PAGE 1 OF 17)
- Purchase price: Section 3.A table, row A, column 3 → dollar amount string
- All cash: checkbox in column 4 of same row → true only if checked
- Initial deposit: Section 3.D(1), amount in column 3, due days in column 4 → object { amount, due }
- Close of escrow: Section 3.B, days in column 4 → string (number of days)

# LOAN TYPE PRIORITY RULES (RPA PAGE 1 OF 17)
- Pre-printed text says "Conventional"
- BELOW it there are 4 checkboxes: FHA, VA, Seller Financing, Other
- Checkbox detection overrides pre-printed text
- Exactly ONE checkbox marked → loan_type = that option
- MULTIPLE checkboxes → loan_type: null, loan_type_note: "undefined: multiple boxes checked"
- "All Cash" checked elsewhere → loan_type: null, all_cash: true
- No checkboxes → loan_type: "Conventional"

# CONTINGENCY WAIVER DETECTION (RPA PAGE 2 OF 17 (CONTINGENCIES))
On the labeled "RPA PAGE 2 OF 17 (CONTINGENCIES)":
- Contingencies are in table Section L with 5 columns
- Column 4: number of days (usually "17 (or ___)")
- Column 5: waiver checkbox ("No loan contingency", "No appraisal contingency", etc.)
- If waiver checkbox in Column 5 is CHECKED (filled, X, shaded, or marked) → contingency WAIVED → days = 0
- If waiver checkbox in Column 5 is EMPTY → contingency active → use days from Column 4 (default 17 if blank)
Specific rows:
  L(1) → loan_days
  L(2) → appraisal_days
  L(3) → investigation_days
  L(8) → crb_attached_and_signed: true if "CR-B attached" box checked in Column 5
  L(9) → cop_contingency: true if "C.A.R. Form COP attached" box checked in Column 5

# SELLER CREDIT TO BUYER (RPA PAGE 2 OF 17 (CONTINGENCIES))
- Section G(1): checkbox + dollar amount field
- If checkbox checked and amount present → return amount string
- Otherwise → null

# HOME WARRANTY (RPA PAGE 3 OF 17 (ITEMS INCLUDED & HOME WARRANTY))
- Row Q(18): checkboxes for who pays (Buyer / Seller / Both)
- Return the checked option as ordered_by ("Buyer", "Seller", "Both")
- If "Buyer waives home warranty plan" checked → ordered_by: "Waived"
- Seller max cost: text "cost not to exceed $___" → extract amount
- Provider: line below "Issued by:" → full company name exactly as written (or null if missing)

# HOME WARRANTY PROVIDER
- On RPA Page 3, in the same row as home warranty (usually Q18)
- Look BELOW the "who pays" checkboxes for a line that reads "Issued by: [Company Name]" or similar
- Extract the full provider name exactly as written
- Common providers: Old Republic Home Protection, American Home Shield, First American, etc.
- If no provider listed or warranty waived → provider: null

# ACCEPTANCE DATE RULES
1. If NO counter offers → use RPA Seller signature date (Page 16)
2. If counter offers exist:
   - Find the HIGHEST NUMBERED counter with BOTH signatures
   - If latest is buyer-originated (RPA, BCO) → Seller signature date = acceptance
   - If latest is seller-originated (SCO, SMCO) → Buyer signature date = acceptance

# COUNTER OFFER MERGE RULES
Counters only replace SPECIFIC fields they mention.

# CONTINGENCY DEFAULTS (fallback only)
If field blank/not found after waiver check:
- Loan contingency: 17 days
- Appraisal contingency: 17 days
- Investigation contingency: 17 days
- Seller delivery of docs: 7 days
- Loan type: "Conventional" (if not all cash)

Return ONLY valid JSON matching this exact schema:

EXAMPLE SCHEMA REPLACE WITH EXTRACTED DATA ONLY - NO EXPLANATIONS:

{
  "extracted": {
    "buyer_names": ["Bruce Lee Calamoteos"],
    "property_address": {
      "full": "123 Main St, City, CA 95001"
    },
    "purchase_price": "$1,125,000.00",
    "all_cash": false,
    "close_of_escrow": "30",
    "initial_deposit": {
      "amount": "$11,250.00",
      "due": "3"
    },
    "loan_type": "FHA",
    "loan_type_note": null,
    "seller_credit_to_buyer": null,
    "contingencies": {
      "loan_days": 17,
      "appraisal_days": 17,
      "investigation_days": 17,
      "crb_attached_and_signed": false
    },
    "cop_contingency": false,
    "seller_delivery_of_documents_days": 7,
    "home_warranty": {
      "ordered_by": "Seller",
      "seller_max_cost": "$600.00",
      "provider": "Old Republic Home Protection"
    },
    "final_acceptance_date": "10/04/2025",
    "counters": {
      "has_counter_or_addendum": true,
      "counter_chain": ["RPA", "ADM", "SCO #1"],
      "final_version_page": null,
      "summary": "ADM (general terms) + SCO #1 (removes Addendum #1, changes buyer agent compensation to 2%)"
    },
    "buyers_broker": {
      "brokerage_name": "eXp Realty of California, Inc.",
      "agent_name": "Nick McEldowney",
      "email": "nick@strockrealestate.com",
      "phone": "(831)566-0558"
    },
    "sellers_broker": {
      "brokerage_name": "Real Broker Technologies",
      "agent_name": "Jennifer Irwin / Chris Irwin",
      "email": "Jennie.Irwin@CraftBauer.com",
      "phone": "(209)345-2583"
    }
  },
  "confidence": {
    "overall_confidence": 98,
    "purchase_price": 100,
    "property_address": 100,
    "buyer_names": 100,
    "close_of_escrow": 100,
    "final_acceptance_date": 100,
    "contingencies": 95,
    "home_warranty": 90,
    "brokerage_info": 95,
    "loan_type": 95
  },
  "handwriting_detected": false
}
  END OF EXAMPLE
`.trim();

export const SECOND_TURN_PROMPT = `The previous extraction had low confidence or detected handwriting.

Re-examine ONLY the pages shown below with extreme care.
Return the exact same JSON schema as before, but with updated values and new confidence scores.

Previous result (for context only, do NOT copy blindly):
{{PREVIOUS_JSON}}

Now correct and return the final JSON:`.trim();