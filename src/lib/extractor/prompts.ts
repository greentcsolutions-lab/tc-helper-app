// src/lib/extractor/prompts.ts
// Version: 2.4.0 - 2025-12-20
// UPDATED: Classification prompt now instructs Grok to look at BOTTOM 15% of full-page images
// KEPT: Explicit JSON response schema, footer matching patterns, sequential hints

import { RPA_FORM, COUNTER_OFFERS, KEY_ADDENDA } from "./form-definitions";

/**
 * Builds the classifier prompt dynamically based on total pages
 * Grok receives FULL PAGE PNGs but is instructed to focus on the BOTTOM 15%
 */
export function buildClassifierPrompt(totalPages: number): string {
  return `You are analyzing FULL-PAGE images from a ${totalPages}-page California real estate transaction packet.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ CRITICAL: LOOK ONLY AT THE BOTTOM 15% OF EACH IMAGE ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Each image shows a complete page, but you must IGNORE the top 85% and focus ONLY on the footer area (bottom 15%).

The footer contains a single-line identifier that looks like this:
[FORM_CODE] Revised mm/yy (PAGE N OF M)

Each image is tagged as "━━━ Image X/${totalPages} ━━━" where X is the PDF page number (1-${totalPages}).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR TASK: Find these EXACT forms by examining the footer text (bottom 15% only)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ FOOTER MATCHING: Look for this EXACT pattern in the BOTTOM 15% of each image

The critical identifier is ALWAYS this single-line string:
[FORM_CODE] Revised mm/yy (PAGE N OF M)

"Revised" can appear in any case (REVISED, Revised, revised, etc.).

Exact examples of real footer text:
- "RPA REVISED 6/25 (PAGE 1 OF 17)"
- "RPA Revised 6/25 (PAGE 2 OF 17)"
- "SCO Revised 12/24 (PAGE 1 OF 2)"
- "SCO Revised 12/24 (PAGE 2 OF 2)"
- "ADM REVISED 6/25 (PAGE 1 OF 1)"

FORM_CODE is always uppercase: RPA, SCO, BCO, SMCO, ADM, TOA, AEA.

Ignore all other form codes. 
Ignore alignment — the line may be left-aligned or centered.
Ignore all other lines, titles, broker information, logos, or any other content in the footer.
DO NOT look at page headers or main content area - footer only (bottom 15%).

Match ONLY when you can clearly read the complete revision line in the footer.
If the text is blurry or incomplete, do NOT match it.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. RPA (MAIN CONTRACT)
If the revision line in the BOTTOM 15% contains "RPA" + any case "Revised" + date + "(PAGE N OF 17)" and N is:
- 1 → RPA Page 1
- 2 → RPA Page 2
- 3 → RPA Page 3
- 16 → RPA Page 16
- 17 → RPA Page 17

**SEQUENTIAL HINT** (use to increase confidence):
- Pages 1–3 are usually consecutive PDF pages
- Pages 16–17 are usually consecutive and near the end of the RPA block

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. COUNTER OFFERS (SCO, BCO, SMCO)
If footer contains "SCO Revised" + date + "(PAGE N OF 2)" → Seller Counter Offer
If footer contains "BCO Revised" + date + "(PAGE N OF 1)" → Buyer Counter Offer
If footer contains "SMCO Revised" + date + "(PAGE N OF 2)" → Seller Multiple Counter

For counters, capture ALL pages (both page 1 AND page 2 for SCO/SMCO).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. KEY ADDENDA (ADM, TOA, AEA)
If footer contains "ADM Revised" + date + "(PAGE 1 OF 1)" → General Addendum
If footer contains "TOA Revised" + date + "(PAGE 1 OF 1)" → Text Overflow Addendum
If footer contains "AEA Revised" + date + "(PAGE 1 OF 1)" → Amendment

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Return ONLY this exact JSON structure (no markdown, no explanation):

{
  "total_pages_analyzed": ${totalPages},
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

EXAMPLE RESPONSE for a 40-page packet where:
- RPA pages 1-3 are at PDF pages 7-9
- RPA pages 16-17 are at PDF pages 22-23
- SCO found at PDF pages 1-2
- ADM found at PDF page 40

{
  "total_pages_analyzed": 40,
  "rpa_pages": {
    "page_1_at_pdf_page": 7,
    "page_2_at_pdf_page": 8,
    "page_3_at_pdf_page": 9,
    "page_16_at_pdf_page": 22,
    "page_17_at_pdf_page": 23
  },
  "counter_offer_pages": [1, 2],
  "addendum_pages": [40]
}

RULES:
- Set page numbers to null if not found
- Do NOT hallucinate page numbers beyond ${totalPages}
- Use the PDF page number from the "━━━ Image X/${totalPages} ━━━" tag
- Double-check all page numbers are ≤ ${totalPages}
- ONLY look at the BOTTOM 15% of each image for footer text`.trim();
}

export const EXTRACTOR_PROMPT = `
You are extracting key terms from 5 or more critical PNG pages of a California Residential Purchase Agreement (RPA Revised 6/25) packet.
These images are high-resolution (200 DPI) flattened renders — all form fields are baked in as static text/lines.

Use FINAL ACCEPTED terms only: counters and addenda override the original RPA.

# LOAN TYPE PRIORITY RULES
- On RPA Page 1, financing section: pre-printed text says "Conventional"
- BELOW it there are 4 checkboxes: FHA, VA, Seller Financing, Other
- Checkbox detection overrides the pre-printed text
- If exactly ONE checkbox is marked → loan_type = that option ("VA", "FHA", "Seller Financing", "Other")
- If MULTIPLE checkboxes are marked → loan_type: null and loan_type_note: "undefined: multiple boxes checked"
- If "All Cash" is explicitly checked elsewhere in financing → loan_type: null, all_cash: true
- If no checkboxes marked → loan_type: "Conventional"

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

# CONTINGENCY DEFAULTS
If field blank/not found:
- Loan contingency: 17 days (unless waived)
- Appraisal contingency: 17 days (unless waived)
- Investigation contingency: 17 days
- Seller delivery of docs: 7 days
- Loan type: "Conventional" (if not all cash)

Return ONLY valid JSON matching this exact schema:

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
`.trim();

export const SECOND_TURN_PROMPT = `The previous extraction had low confidence or detected handwriting.

Re-examine ONLY the pages shown below with extreme care.
Return the exact same JSON schema as before, but with updated values and new confidence scores.

Previous result (for context only, do NOT copy blindly):
{{PREVIOUS_JSON}}

Now correct and return the final JSON:`.trim();