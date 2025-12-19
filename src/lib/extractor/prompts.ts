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
  return `You are analyzing ONLY the bottom ~15% footer strip of each page from a ${totalPages}-page California real estate transaction packet.

Each image is labeled "━━━ Image X/${totalPages} ━━━" where X is the PDF page number (1-based).

CRITICAL: Look EXCLUSIVELY at the BOTTOM-LEFT footer text. This is the ONLY reliable identifier in the crop.

The format is always:
[FORM_CODE] REVISED mm/yy (PAGE N OF M)

Examples (case of "Revised"/"REVISED" may vary):
- "RPA REVISED 6/25 (PAGE 1 OF 17)"
- "SCO REVISED 12/24 (PAGE 1 OF 2)"
- "ADM REVISED 6/25 (PAGE 1 OF 1)"
- "TOA REVISED 6/25 (PAGE 1 OF 1)"
- "AEA REVISED 6/25 (PAGE 1 OF 1)"

The FORM_CODE is always uppercase (RPA, SCO, BCO, SMCO, ADM, TOA, AEA).

YOUR TASK: Identify pages by matching this exact bottom-left pattern only.

1. RPA PAGES (main contract – total 17 pages)
   Match:
   - "RPA ... (PAGE 1 OF 17)"  → RPA Page 1
   - "RPA ... (PAGE 2 OF 17)"  → RPA Page 2
   - "RPA ... (PAGE 3 OF 17)"  → RPA Page 3
   - "RPA ... (PAGE 16 OF 17)" → RPA Page 16
   - "RPA ... (PAGE 17 OF 17)" → RPA Page 17

2. COUNTER OFFERS – capture EVERY page of EVERY counter
   Match:
   - "SCO ... (PAGE X OF 2)"   → Seller Counter (include both pages)
   - "BCO ... (PAGE X OF 1)"   → Buyer Counter
   - "SMCO ... (PAGE X OF 2)"  → Seller Multiple Counter (include both pages)

3. KEY SINGLE-PAGE ADDENDA
   Match ONLY:
   - "ADM ... (PAGE 1 OF 1)"
   - "TOA ... (PAGE 1 OF 1)"
   - "AEA ... (PAGE 1 OF 1)"

Ignore any centered text, headers, or other footer lines. Do NOT match disclosures or other forms.

Return ONLY this exact JSON (no extra text or markdown):

{
  "total_pages_analyzed": ${totalPages},
  "rpa_pages": {
    "page_1_at_pdf_page": number | null,
    "page_2_at_pdf_page": number | null,
    "page_3_at_pdf_page": number | null,
    "page_16_at_pdf_page": number | null,
    "page_17_at_pdf_page": number | null
  },
  "counter_offer_pages": [/* ALL PDF page numbers belonging to any SCO/BCO/SMCO */],
  "addendum_pages": [/* PDF page numbers for ADM/TOA/AEA only */]
}

If no match on a page, omit it / use null. Do not guess.`.trim();
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