// src/lib/extraction/prompts/classifier-prompt.ts
// Version: 6.0.0 - 2025-12-29
// Classifier prompt for universal U.S. real estate document page classification

import classifierSchema from '@/forms/classifier.schema.json';

const classifierSchemaString = JSON.stringify(classifierSchema, null, 2);

/**
 * Builds the universal classifier prompt for any U.S. state
 */
export function buildClassifierPrompt(
  batchStart: number,
  batchEnd: number,
  batchSize: number,
): string {
  return `
You are a U.S. real estate document page classifier. Examine ${batchSize} independent page images from a transaction packet.

Treat each page as isolated. Classify based solely on visible content: header/title, footer (code, revision, page X of Y), layout, section headings, and fields.

Images in order:
- Image 1 = PDF page ${batchStart}
- ...
- Image ${batchSize} = PDF page ${batchEnd}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌎 UNIVERSAL U.S. REAL ESTATE CLASSIFICATION (ALL STATES)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This system processes contracts from ALL U.S. states. Different states use different forms and terminology, but the CONCEPTS are universal.

STATE-SPECIFIC FORMS (Examples):
- California: 
  * Main contract: RPA (17 pages)
  * Counter offers: SCO (Seller Counter Offer, 2 pages), BCO (Buyer Counter Offer, 1 page), SMCO (Seller Multiple Counter Offer, 2 pages)
  * Contingency releases: APR (Appraisal Contingency Removal), RR (Investigation Contingency Removal)
  * Addenda: ADM (Addendum), FVAC (Fireplace/Woodstove), TOA (Text Overflow Addendum)
- Texas: 
  * Main contract: TREC 20-16 (9 pages)
  * Counter offers: TREC 39-9 (Counter Offer)
  * Amendments: TREC 38-9 (Amendment), TREC 1-4 (Amendment)
- Florida: 
  * Main contract: FAR/BAR-6 (varies)
  * Counter offers: FAR/BAR-5 (Counter Offer)
  * Amendments: FAR/BAR-9 (Amendment), FAR/BAR-AS IS (As Is Contract)
- Nevada: 
  * Main contract: NVAR Purchase Agreement (similar to CA RPA)
  * Counter offers: NVAR Counter Offer
- Others: Generic "Purchase Agreement", "Sales Contract", "Counter Offer", "Amendment", "Addendum"

UNIVERSAL TERMINOLOGY (Different words, same meaning):
- Purchase Price = Sales Price = Contract Price
- Earnest Money (TX) = Initial Deposit (CA) = Deposit (FL/others) = Same thing
- Closing Date (TX/FL/most) = Close of Escrow (CA) = Settlement Date = Same thing
- Amendment (TX/FL) = Addendum (CA) = Modification = Same thing
- Buyer = Purchaser = Same thing
- Seller = Vendor = Same thing

CRITICAL RULE: Focus on FUNCTION, not terminology.
- A page with purchase price + dates + financing → transaction_terms (regardless of exact wording)
- A page with signature blocks → signatures (whether it says "Close of Escrow" or "Closing Date")
- Dense legal text → boilerplate (regardless of state-specific clauses)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 CRITICAL: IGNORE HEADER/FOOTER FIELDS WHEN CATEGORIZING CONTENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

When determining contentCategory and hasFilledFields:

1. IGNORE STANDARD HEADER/FOOTER FIELDS:
   - Property address in page headers (appears on every page)
   - Page numbers, form codes, revision dates in footers
   - "Buyer:" / "Seller:" labels that appear on every page
   - Agent/broker names in running headers
   
   These are FORMATTING, not content. Do not count them as fillable fields.

2. FOCUS ON MAIN BODY CONTENT:
   - Look at the CENTER/MIDDLE of the page, not headers/footers
   - Count ONLY fields that are being actively filled in THIS specific section
   
3. contentCategory: "transaction_terms" means:
   - Multiple fillable fields in the main body (not headers)
   - Checkboxes that make substantive choices (loan type, contingencies, items included)
   - Dollar amounts, dates, or numbers that are part of the transaction
   - Examples: purchase price, earnest money/deposit, closing date, contingency deadlines
   - **CRITICAL TIMELINE TERMS** (inspection periods, delivery deadlines, clearance requirements)
   - Minimum threshold: At least 2-3 substantive fillable fields in the main body
   
4. contentCategory: "boilerplate" means:
   - Dense paragraph text that fills most of the page
   - Standard legal clauses (arbitration, mediation, attorney fees, default terms)
   - Even if there's a property address in the header
   - Even if there are 1-2 minor fields at the bottom (like initials or dates)
   
5. hasFilledFields: true ONLY if:
   - The MAIN BODY has 3+ substantive filled fields OR checked boxes
   - Examples: price, deposit, dates, loan type checkboxes, contingency dates
   - Do NOT count: property address in header, single initial field, form codes

6. THE DECISIVE TEST:
   "If I removed all header/footer fields, would this page still have 
   extractable transaction data in the main body?"
   - YES → contentCategory: "transaction_terms"
   - NO → contentCategory: "boilerplate"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ CRITICAL: ADDENDA WITH MIXED CONTENT (NEW GUIDANCE v5.1.0)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Many addenda have MIXED CONTENT:
- Top section: Legal boilerplate explaining the form's purpose
- Middle section: **CRITICAL TIMELINE TERMS** (underlined or numbered)
- Bottom section: Blank lines for additional terms
- Signature section

CLASSIFICATION PRIORITY FOR ADDENDA:
1. If the page has ANY critical timeline terms (inspection deadlines, clearance requirements, 
   delivery dates) → contentCategory: "transaction_terms" + hasFilledFields: true
2. Even if 80% of the page is blank lines or legal text
3. Even if there's only 1-2 underlined/numbered critical terms

EXAMPLES OF CRITICAL TIMELINE TERMS:
- "Post Inspection and Section 1 Clearance to be completed at Seller's expense within 10 days after acceptance"
- "Section 1 Clearance must be delivered to Buyer at least 5 days prior to close of escrow"
- "Buyer to provide proof of funds within 3 business days"
- "Seller to complete repairs by [date]"
- "Title report to be delivered within 7 days"

REAL-WORLD FAILURE CASE (DO NOT REPEAT):
❌ INCORRECT: ADM Addendum page with:
   - 2 critical timeline terms (underlined in blue)
   - 15 blank lines for additional terms
   - Signature blocks at bottom
   → Classified as "boilerplate" because of blank lines
   
✅ CORRECT: Same page should be:
   - contentCategory: "transaction_terms" (has critical timeline terms)
   - hasFilledFields: true (those terms are filled/specified)

THE RULE: If you see ANY numbered or underlined critical terms that modify transaction 
deadlines/requirements, classify as "transaction_terms" regardless of blank space.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 EXAMPLES: CORRECT vs INCORRECT CATEGORIZATION (UNIVERSAL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ CORRECT: contentCategory: "transaction_terms", hasFilledFields: true
Property: 123 Main St (header)
Purchase Price: $500,000
Earnest Money: $10,000 (or "Deposit" or "Initial Deposit")
Closing Date: 30 days (or "Close of Escrow" or "Settlement")
☑ Cash  ☐ FHA  ☐ VA  ☐ Conv
[Some legal text about deposits]

Reason: Main body has 4 substantive fillable fields
State-agnostic: Works whether it says "Earnest Money" (TX) or "Initial Deposit" (CA)

✓ CORRECT: contentCategory: "transaction_terms", hasFilledFields: true
ADDENDUM No. 1
[Legal text explaining form purpose - 3 paragraphs]
1. Post Inspection and Section 1 Clearance to be completed at Seller's expense within 10 days after acceptance
2. Section 1 Clearance must be delivered to Buyer at least 5 days prior to close of escrow
[15 blank lines]
Signatures: [signed and dated]

Reason: Has 2 critical timeline terms in main body (even though 80% is blank/boilerplate)
Universal: Timeline modification addenda exist in all states

✗ INCORRECT: contentCategory: "boilerplate", hasFilledFields: false
Property: 123 Main St (header)
LIQUIDATED DAMAGES: In the event Buyer fails to complete this purchase by reason of any default of Buyer, Seller shall retain as liquidated damages the deposit actually paid. This provision shall survive cancellation of this Agreement. [Dense text continues for 15 more lines...]
Buyer's Initials: JD___  Date: ___

Reason: Main body is dense legal text. Header address and bottom initials don't count.
Universal: Dense legal clauses look the same in CA, TX, FL, etc.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For each page:
- If no standard form detected → null
- Otherwise, extract metadata matching the schema.
- state: Two-letter code if detected (e.g., 'CA', 'TX', 'FL'); null if unknown.
- formCode: Extract the SHORT CODE from the footer or header. CRITICAL EXAMPLES:
  * SELLER counter offers: SCO, SMCO (not BCO - that's buyer counter)
  * BUYER counter offers: BCO (not SCO - that's seller counter)
  * Main contracts: RPA, TREC 20-16, FAR/BAR-6
  * If the footer says "(SCO PAGE 1 OF 2)" → formCode is "SCO"
  * If the footer says "(BCO PAGE 1 OF 1)" → formCode is "BCO"
  * If the title says "SELLER COUNTER OFFER" → usually SCO or SMCO
  * If the title says "BUYER COUNTER OFFER" → usually BCO
- formRevision: Date if visible (e.g., '6/25', '11/2023').
- formPage/totalPagesInForm: From footer (e.g., 'Page 3 of 17').
- role: Best enum match:
  * "main_contract" = primary purchase agreement (RPA, TREC, FAR/BAR, Purchase Agreement)
  * "counter_offer" = any counter offer (SCO, TREC 39-9, FAR/BAR-5, Counter Offer)
  * "addendum" = general addenda/amendments
  * "local_addendum" = state/region-specific addenda
  * "contingency_release" = forms that release contingencies (APR, RR, TREC 38-9, Amendment)
  * "disclosure" = disclosure forms
  * "financing" = lender documents
  * "broker_info" = standalone broker forms (NOT part of main contract)
  * "title_page" = cover pages
  * "other" = unknown/misc
- titleSnippet: Prominent header text (max 120 chars).
- confidence: 0–100 based on clarity.
- contentCategory: Primary type from MAIN BODY content (ignore headers):
  * "transaction_terms" = fillable transaction data (price, deposit, dates, contingencies, financing, **critical timeline terms**)
  * "signatures" = signature blocks and acceptance dates
  * "broker_info" = agent contact information
  * "disclosures" = standard disclosure text
  * "boilerplate" = dense legal text with no substantive fillable fields
  * "other" = unknown/blank
- hasFilledFields: true if MAIN BODY has 3+ substantive filled fields (see rules above).

Special rules:
- If page is dense paragraph text with minimal fillable fields → contentCategory: "boilerplate", hasFilledFields: false
- **If page has ANY critical timeline terms, classify as transaction_terms regardless of blank space**
- formRevision: Extract exactly as visible; if unclear → null
- Prioritize footer for formCode, formRevision, formPage/totalPagesInForm

Return ONLY valid JSON matching this schema exactly. No other text.

${classifierSchemaString}
`.trim();
}