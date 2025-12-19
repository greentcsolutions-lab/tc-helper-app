// src/lib/extractor/prompts.ts
// Version: 2.1.0 - 2025-12-19
// Updated for footer-only image classification
// Dynamic prompt generation with field coordinates and handwriting rejection

import { RPA_FORM, COUNTER_OFFERS, KEY_ADDENDA } from "./form-definitions";

/**
 * Builds the classifier prompt dynamically based on total pages
 * Grok receives footer-only PNGs tagged with "Image X/Y:" prefix
 */
export function buildClassifierPrompt(totalPages: number): string {
  return `You are analyzing FOOTER IMAGES from a ${totalPages}-page California real estate transaction packet.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ CRITICAL: YOU ARE ONLY SEEING THE BOTTOM 15% OF EACH PAGE ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Each image shows ONLY the footer region (bottom 15% of the page).
You will NOT see headers, main content, or signatures - ONLY footer text.

Each image is tagged as "━━━ Image X/${totalPages} ━━━" where X is the PDF page number (1-${totalPages}).

YOUR TASK: Find these EXACT forms by examining the footer text in each image.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ FOOTER LOCATION: CHECK BOTH CENTER AND LEFT FOOTERS ⚠️

California forms place critical identifiers in TWO possible locations:

1. **Bottom LEFT footer** (most common):
   Example: "RPA REVISED 6/25 (PAGE 1 OF 17)"
   Example: "SCO Revised 12/24 (PAGE 1 OF 2)"

2. **Bottom CENTER footer** (some forms like ADM):
   Example: "ADM REVISED 6/25 (PAGE 1 OF 1)"
   
**Match on EITHER location - check BOTH left and center footers for the pattern: "(PAGE X OF Y)"**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. RPA (MAIN CONTRACT)
   Footer Pattern: "RPA REVISED X/XX (PAGE X OF 17)" - BOTTOM LEFT corner

   Find these SPECIFIC internal RPA pages:
   • **RPA Page 1**: Footer shows "(PAGE 1 OF 17)"
   • **RPA Page 2**: Footer shows "(PAGE 2 OF 17)"
   • **RPA Page 3**: Footer shows "(PAGE 3 OF 17)"
   • **RPA Page 16**: Footer shows "(PAGE 16 OF 17)"
   • **RPA Page 17**: Footer shows "(PAGE 17 OF 17)"

   **SEQUENTIAL VALIDATION**: 
   - Pages 1-3 are USUALLY consecutive PDF pages (e.g., PDF 11, 12, 13)
   - Pages 16-17 are USUALLY consecutive and near the END of the RPA block (e.g., PDF 27, 28)
   - If you find Page 1 at PDF page 11, check PDF pages 12-13 for Pages 2-3
   - If you find Page 16 at PDF page 27, check PDF page 28 for Page 17

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. COUNTER OFFERS (CAPTURE ALL PAGES OF ALL COUNTERS)

   Footer Patterns (BOTTOM LEFT):
   • "(SCO PAGE X OF 2)" - Seller Counter Offer
   • "(BCO PAGE X OF 1)" - Buyer Counter Offer  
   • "(SMCO PAGE X OF 2)" - Seller Multiple Counter Offer

   **IMPORTANT**: There may be MULTIPLE counter offers (SCO #1, SCO #2, BCO #1, etc.)
   Find EVERY page of EVERY counter in the packet.

   Example: If you see "(SCO PAGE 1 OF 2)" on page 38 and "(SCO PAGE 2 OF 2)" on page 39,
   report BOTH pages [38, 39].

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. KEY ADDENDA (SINGLE-PAGE FORMS)

   **CRITICAL: ONLY match these EXACT footer patterns (BOTTOM LEFT):**
   • "(ADM PAGE 1 OF 1)" - Addendum (with abbreviation ADM)
   • "(TOA PAGE 1 OF 1)" - Text Overflow Addendum (with abbreviation TOA)
   • "(AEA PAGE 1 OF 1)" - Amendment of Existing Agreement Terms (with abbreviation AEA)

   **IGNORE any other forms** unless they have one of these exact footers.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STRICT MATCHING RULES:
✓ Check BOTH bottom left AND bottom center footers
✓ Footer must show exact pattern: "(PAGE X OF Y)" or "(SCO PAGE X OF Y)"
✓ RPA footers: "(PAGE X OF 17)" in left OR center
✓ Counter footers: "(SCO PAGE X OF Y)", "(BCO PAGE X OF Y)", or "(SMCO PAGE X OF Y)" in left OR center
✓ Addendum footers: "(ADM PAGE 1 OF 1)", "(TOA PAGE 1 OF 1)", or "(AEA PAGE 1 OF 1)" in left OR center
✓ Only report pages where you can CLEARLY read the footer text in the image
✓ Page numbers must be between 1 and ${totalPages}
✓ If the footer is blurry or unclear, DO NOT include it
✓ Use sequential logic: if you find RPA Page 1 at PDF page 11, check pages 12-13 next
✓ Remember: You're only seeing the bottom 15% of each page (the footer strip)

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

export const EXTRACTOR_PROMPT = `You are extracting California RPA contract data. These pages have been pre-filtered to show ONLY the critical pages.

# CRITICAL HANDWRITING RULE
**IF YOU SEE ANY HANDWRITTEN TEXT OVERLAID ON TOP OF TYPED TEXT, IMMEDIATELY RETURN:**
{
  "extracted": {},
  "confidence": { "overall_confidence": 0 },
  "handwriting_detected": true,
  "rejection_reason": "Handwritten modifications over typed text detected - legal violation"
}

Handwriting ALONGSIDE typed text is acceptable. Handwriting OVER typed text is a REJECT.

# DOCUMENT STRUCTURE
You're looking at specific pages from a 17-page RPA form. The form uses a **5-column table** spanning pages 1-3 (Section 3).

## RPA PAGE 1 - Top Section (Above Table)
- **Section 1.A** (Full width): "THIS IS AN OFFER FROM [Buyer Names]"
- **Section 1.B** (Full width): Property address (directly under 1.A)

## RPA PAGE 1-3 - Five-Column Table (Section 3)
The table has 5 columns. Field locations are specified as Section.Row(Subrow), Column.

| Col 1 | Col 2 | Col 3 | Col 4 | Col 5 |
|-------|-------|-------|-------|-------|

### PAGE 1 TABLE FIELDS:
- **3.A** (Purchase Price): Columns 2-4, checkbox "All Cash" in Column 5
- **3.B** (Close of Escrow): Column 4 (can be "X days" or "MM/DD/YYYY")
- **3.D(1)** (Initial Deposit): Amount in Column 4, Due date in Column 5

### PAGE 2 TABLE FIELDS:
- **3.E(1)** (Loan Type): Column 5 (null if All Cash checked)
- **3.G(1)** (Seller Credit): Checkbox Column 3, Amount Column 4
- **L(1)** (Loan Contingency): Days in Column 4, Waiver checkbox in Column 5
- **L(2)** (Appraisal Contingency): Days in Column 4, Waiver checkbox in Column 5
- **L(3)** (Investigation Contingency): Days in Column 4
- **L(8)** (CR-B Attached): Checkbox in Column 5 (multi-row span)
- **L(9)** (COP - Contingency for Sale): Checkbox in Columns 3+5 (combined cell, near right)
- **N(1)** (Seller Delivery of Documents): Days in Column 4

### PAGE 3 TABLE FIELDS:
- **3.Q(18)** (Home Warranty): Who pays in Columns 4+5 (combined), Max cost right side

## RPA PAGE 16-17 - Signatures & Brokers
- **Page 16**: Seller signature blocks with dates
- **Page 17**: "REAL ESTATE BROKERS" section (may be blank)

## COUNTER OFFERS & ADDENDA
If you see SCO, BCO, or SMCO forms:
- Extract the **counter number** (e.g., "SELLER COUNTER OFFER NO. 2" → #2)
- Identify which fields are being modified
- Check for **both buyer AND seller signatures** with dates
- Invalid if missing either signature

# EXTRACTION SCHEMA
Return ONLY this JSON structure (no markdown, no preamble):

{
  "extracted": {
    "buyer_names": ["John Doe", "Jane Doe"],
    "property_address": { "full": "123 Main St, Los Angeles, CA 90210" },
    "purchase_price": "$1,250,000",
    "all_cash": false,
    "close_of_escrow": "30",
    
    "initial_deposit": {
      "amount": "$50,000",
      "due": "3"
    },
    
    "loan_type": "Conventional",
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
      "seller_max_cost": "$500"
    },
    
    "final_acceptance_date": "12/15/2024",
    
    "counters": {
      "has_counter_or_addendum": false,
      "counter_chain": ["RPA"],
      "final_version_page": 16,
      "summary": "No counters"
    },
    
    "buyers_broker": {
      "brokerage_name": "ABC Realty",
      "agent_name": "John Smith",
      "email": "john@example.com",
      "phone": "555-1234"
    },
    
    "sellers_broker": { }
  },
  
  "confidence": {
    "overall_confidence": 95,
    "purchase_price": 100,
    "property_address": 100,
    "buyer_names": 98,
    "close_of_escrow": 95,
    "final_acceptance_date": 95,
    "contingencies": 90,
    "home_warranty": 75,
    "brokerage_info": 70
  },
  
  "handwriting_detected": false
}

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

Return ONLY valid JSON. No markdown, no explanation.`.trim();

export const SECOND_TURN_PROMPT = `The previous extraction had low confidence or detected handwriting.

Re-examine ONLY the pages shown below with extreme care.
Return the exact same JSON schema as before, but with updated values and new confidence scores.

Previous result (for context only, do NOT copy blindly):
{{PREVIOUS_JSON}}

Now correct and return the final JSON:`;