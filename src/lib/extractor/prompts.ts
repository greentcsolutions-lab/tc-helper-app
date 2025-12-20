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

Each image is explicitly labeled above it with its exact role (e.g., "RPA PAGE 1 OF 17", "SELLER COUNTER OFFER #1").

CRITICAL RULES:
1. Use the labeled RPA pages as primary source.
2. Counters/addenda override any conflicting terms in the main RPA.
3. Latest fully-signed counter with both signatures determines final acceptance date.
4. For every field provide a confidence score 0–100. Lower if handwriting is present.

Return ONLY valid JSON conforming exactly to the schema (no extra text, no markdown).

Schema reminder (DO NOT copy values — extract fresh from images):
- extracted: { buyer_names: string[], property_address: {full: string}, purchase_price: string, ... }
- confidence: { overall_confidence: number, purchase_price: number, ... }
- handwriting_detected: boolean

Now extract from the labeled images below:`.trim();

export const SECOND_TURN_PROMPT = `The previous extraction had low confidence or detected handwriting.

Re-examine ONLY the pages shown below with extreme care.
Return the exact same JSON schema as before, but with updated values and new confidence scores.

Previous result (for context only, do NOT copy blindly):
{{PREVIOUS_JSON}}

Now correct and return the final JSON:`.trim();