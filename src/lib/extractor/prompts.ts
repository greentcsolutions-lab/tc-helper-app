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

// FIXES: handwriting false-positive on digital sigs, checkbox detection (CRB, home warranty), all-cash loan_type
export const EXTRACTOR_PROMPT = `
You are an expert California real estate transaction analyst examining 5-10 high-resolution PNG images from a single transaction packet.

Each image is labeled with its exact role, e.g.:
- "RPA PAGE 1 OF 17"
- "RPA PAGE 2 OF 17 (CONTINGENCIES)"
- "RPA PAGE 3 OF 17 (ITEMS INCLUDED & HOME WARRANTY)"
- "RPA PAGE 16 OF 17 (SIGNATURES)"
- "RPA PAGE 17 OF 17 (BROKER INFO)"
- "SELLER COUNTER OFFER #1"
- "ADDENDUM" etc.

CRITICAL INSTRUCTIONS — FOLLOW EXACTLY:

1. Extract baseline terms from RPA pages first.
2. Then apply overrides ONLY from counter/addendum pages where a field is explicitly changed.
3. Do NOT assume a counter changes a field unless it is clearly written on that page.

HANDWRITING DETECTION:
- Digital signatures, typed text, printed form text, or DocuSign/HelloSign-style e-signatures are NOT handwriting.
- Set handwriting_detected: true ONLY if you see actual handwritten script (pen/ink marks, cursive, etc.).

CHECKBOX RULES (very important):
- A checkbox is TRUE only if it is clearly filled: checked ✓, X, shaded, darkened, or has text inside.
- Empty, blank, or unchecked box = FALSE.
- If you are unsure, default to FALSE.

ALL CASH → LOAN TYPE:
- If "All Cash" is selected (checkbox in 3.A column 5 checked) → set loan_type: null and loan_type_note: "All Cash".
- Otherwise follow standard loan checkbox rules on Page 1.

SPECIFIC FIELD RULES:

CRB ATTACHED AND SIGNED (RPA Page 2, Section L(8)):
- Checkbox in Column 5 for "CR-B attached and signed".
- Empty/unchecked → crb_attached_and_signed: false

COP CONTINGENCY (RPA Page 2, Section L(9)):
- Checkbox in Column 5 for "C.A.R. Form COP".
- Empty/unchecked → cop_contingency: false

HOME WARRANTY (RPA Page 3, Section Q(18)):
- Look for checkboxes: "Buyer", "Seller", "Both", or "Buyer waives home warranty plan".
- Return the SINGLE checked option as ordered_by.
- If "Buyer waives home warranty plan" checked → ordered_by: "Waived"
- If no checkbox checked or field blank → ordered_by: null
- Seller max cost: extract "$___" amount only if warranty is ordered (not waived).
- Provider: extract "Issued by:" line exactly as written (or null if missing).

FINAL ACCEPTANCE DATE:
- Latest fully-signed document (highest counter # with both signatures).
- Buyer-originated doc (RPA/BCO) → seller signature date = acceptance.
- Seller-originated doc (SCO/SMCO) → buyer signature date = acceptance.

CONFIDENCE:
- Assign 0–100 per field based on clarity.
- Lower for any ambiguity, faint text, or actual handwriting.

Return ONLY one valid JSON object — start with { and end with }. No extra text, no explanations.

{
  "extracted": {
    "buyer_names": string[],
    "property_address": { "full": string },
    "purchase_price": string,
    "all_cash": boolean,
    "close_of_escrow": string,
    "initial_deposit": { "amount": string, "due": string },
    "loan_type": string | null,
    "loan_type_note": string | null,
    "seller_credit_to_buyer": string | null,
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
      "seller_max_cost": string | null,
      "provider": string | null
    },
    "final_acceptance_date": string,
    "counters": {
      "has_counter_or_addendum": boolean,
      "counter_chain": string[],
      "final_version_page": number | null,
      "summary": string
    },
    "buyers_broker": { "brokerage_name": string | null, "agent_name": string | null, "email": string | null, "phone": string | null },
    "sellers_broker": { "brokerage_name": string | null, "agent_name": string | null, "email": string | null, "phone": string | null }
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

Extract fresh values from the labeled images below:`.trim();

export const SECOND_TURN_PROMPT = `The previous extraction had low confidence or detected handwriting.

Re-examine ONLY the pages shown below with extreme care.
Return the exact same JSON schema as before, but with updated values and new confidence scores.

Previous result (for context only, do NOT copy blindly):
{{PREVIOUS_JSON}}

Now correct and return the final JSON:`.trim();