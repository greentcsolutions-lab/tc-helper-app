// src/lib/extractor/prompts.ts
// Version: 3.0.0 - Dynamic prompt generation from form definitions
/**
 * All static prompts are now pure TS exports.
 * Zero fs calls → cold-start safe, tree-shakable, and type-checkable.
 */

import { RPA_FORM, COUNTER_OFFERS, KEY_ADDENDA } from "./form-definitions";

/**
 * Builds the classifier prompt dynamically based on total pages
 * Grok receives tagged PNGs with "Image X/Y:" prefix
 */
export function buildClassifierPrompt(totalPages: number): string {
  return `You are analyzing a ${totalPages}-page California real estate transaction packet converted to PNGs.

Each image is tagged as "Image X/${totalPages}:" where X is the PDF page number (1-${totalPages}).

YOUR TASK: Find these EXACT forms by examining the LOWER RIGHT CORNER footer of each page.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. RPA (MAIN CONTRACT)
   Footer Pattern: "(RPA PAGE X OF 17)" (case-insensitive)

   Find these SPECIFIC internal RPA pages:
   • RPA Page 1 (Purchase price, property address, buyer names)
   • RPA Page 2 (Financing terms, contingencies)
   • RPA Page 3 (Timeline, close of escrow)
   • RPA Page 16 (Seller signatures)
   • RPA Page 17 (Agent contact information)

   Report the PDF page number where each appears.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. COUNTER OFFERS (CAPTURE ALL PAGES OF ALL COUNTERS)

   Footer Patterns:
   • "(SCO PAGE X OF 2)" - Seller Counter Offer
   • "(BCO PAGE X OF 1)" - Buyer Counter Offer
   • "(SMCO PAGE X OF 2)" - Seller Multiple Counter Offer

   IMPORTANT: There may be MULTIPLE counter offers (SCO #1, SCO #2, BCO #1, etc.)
   Find EVERY page of EVERY counter offer in the packet.

   Example: If you see "(SCO PAGE 1 OF 2)" on page 38 and "(SCO PAGE 2 OF 2)" on page 39,
   report BOTH pages [38, 39].

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. KEY ADDENDA (SINGLE-PAGE FORMS)

   **CRITICAL: ONLY match these EXACT footer patterns:**
   • "(ADM PAGE 1 OF 1)" - Addendum (with abbreviation ADM)
   • "(TOA PAGE 1 OF 1)" - Text Overflow Addendum (with abbreviation TOA)
   • "(AEA PAGE 1 OF 1)" - Amendment of Existing Agreement Terms (with abbreviation AEA)

   **IGNORE any other forms with "Addendum" in the title** unless they have one of these exact footers.
   The footer MUST include the specific abbreviation (ADM, TOA, or AEA).

   Report the PDF page number of each addendum found.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STRICT MATCHING RULES:
✓ Footer text must be EXACT (footers are always lowercase in parentheses)
✓ RPA footers must show "(rpa page X of 17)" - check the page number carefully
✓ Counter footers must show exact abbreviation: "(sco page X of Y)", "(bco page X of Y)", or "(smco page X of Y)"
✓ Addendum footers MUST include the abbreviation: "(adm page 1 of 1)", "(toa page 1 of 1)", or "(aea page 1 of 1)"
✓ Only report pages where you can CLEARLY read the footer text
✓ Page numbers must be between 1 and ${totalPages}
✓ If the footer is blurry or unclear, DO NOT include it
✓ If a page has "Addendum" in the title but NO matching footer abbreviation, IGNORE it
✓ No guessing or approximations

RESPONSE FORMAT:
Return ONLY this JSON structure (no markdown, no extra text):

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

EXAMPLE RESPONSE:
{
  "total_pages_analyzed": 42,
  "rpa_pages": {
    "page_1_at_pdf_page": 7,
    "page_2_at_pdf_page": 8,
    "page_3_at_pdf_page": 9,
    "page_16_at_pdf_page": 22,
    "page_17_at_pdf_page": 23
  },
  "counter_offer_pages": [1, 38, 39],
  "addendum_pages": [40]
}`.trim();
}

export const EXTRACTOR_PROMPT = `Extract EXACTLY these fields from the FINAL ACCEPTED version of the contract.

Counters and addenda override the original.
Handwriting overrides typed text.
Use the latest dated/signed version.

Return ONLY valid JSON matching this schema exactly. Include confidence 0–100 for every field.

{
  "extracted": {
    "state": "California",
    "purchase_price": 1250000,
    "buyer_names": ["John Doe", "Jane Doe"],
    "seller_names": ["Robert Smith"],
    "property_address": "123 Main St, Los Angeles, CA 90210",
    "closing_date": "2025-12-15",
    "contingency_removal_date": "2025-11-20",
    "loan_amount": 1000000,
    "down_payment": 250000
  },
  "confidence": {
    "purchase_price": 100,
    "buyer_names": 98,
    "seller_names": 100,
    "property_address": 100,
    "closing_date": 95,
    "overall_confidence": 97
  },
  "handwriting_detected": false
}`.trim();

export const SECOND_TURN_PROMPT = `The previous extraction had low confidence or detected handwriting.

Re-examine ONLY the pages shown below with extreme care.
Handwriting overrides everything.
Return the exact same JSON schema as before, but with updated values and new confidence scores.

Previous result (for context only, do NOT copy blindly):
{{PREVIOUS_JSON}}

Now correct and return the final JSON:`;
