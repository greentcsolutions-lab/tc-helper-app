// src/lib/extractor/prompts.ts
// Version: 2.5.0 - 2025-12-20
// UPDATED: JSON schema now includes pages_in_this_batch for better batch observability

import { RPA_FORM, COUNTER_OFFERS, KEY_ADDENDA } from "./form-definitions";

/**
 * Builds the classifier prompt dynamically based on total pages
 */
export function buildClassifierPrompt(totalPages: number): string {
  return `You are analyzing a batch of ~15 pages from a ${totalPages}-page California real estate transaction packet.

Focus ONLY on the bottom 15% of each image for footer text.

Footer pattern: [FORM_CODE] Revised mm/yy (PAGE N OF M)

Match ONLY when the full line is clearly readable.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CALIFORNIA RPA SEQUENTIAL INFERENCE (CRITICAL — ALWAYS APPLY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The RPA is ALWAYS a consecutive 17-page block.

If you clearly see "RPA ... (PAGE 1 OF 17)" on PDF page P:
  page_1_at_pdf_page = P
  page_2_at_pdf_page = P + 1
  page_3_at_pdf_page = P + 2
  page_16_at_pdf_page = P + 15
  page_17_at_pdf_page = P + 16

If you clearly see "RPA ... (PAGE 2 OF 17)" on PDF page P:
  page_1_at_pdf_page = P - 1
  page_2_at_pdf_page = P
  page_3_at_pdf_page = P + 1
  page_16_at_pdf_page = P + 14
  page_17_at_pdf_page = P + 15

DO NOT infer from Page 3, 16, or 17 alone.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COUNTER OFFERS & ADDENDA (ALWAYS SCAN FOR THESE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Always look for:
- SCO or SMCO → 2-page counter → add both PDF page numbers to counter_offer_pages
- BCO → 1-page counter → add that PDF page number
- ADM, TOA, AEA → 1-page addendum → add that PDF page number

Examples of footers to match:
- "SCO Revised 12/24 (PAGE 1 OF 2)"
- "SCO Revised 12/24 (PAGE 2 OF 2)"
- "BCO Revised 6/25 (PAGE 1 OF 1)"
- "ADM REVISED 6/25 (PAGE 1 OF 1)"

If you see any of these, include ALL relevant pages.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Return ONLY this exact JSON:

{
  "pages_in_this_batch": number,
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

EXAMPLE (RPA Page 1 at 11 + SCO at 38–39 + ADM at 40):
{
  "pages_in_this_batch": 15,
  "total_document_pages": 40,
  "rpa_pages": {
    "page_1_at_pdf_page": 11,
    "page_2_at_pdf_page": 12,
    "page_3_at_pdf_page": 13,
    "page_16_at_pdf_page": 26,
    "page_17_at_pdf_page": 27
  },
  "counter_offer_pages": [38, 39],
  "addendum_pages": [40]
}

RULES:
- pages_in_this_batch = exact number of images in this batch
- Infer full RPA block from Page 1 or 2
- Always include all counter and addendum pages seen
- null if not found`.trim();
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