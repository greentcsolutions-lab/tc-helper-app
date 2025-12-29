// src/lib/extraction/prompts.ts
// Version: 5.0.0 - 2025-12-29
// ENHANCED: Multi-state counter offer examples + clearer override rules
// NEW: Explicit examples for CA, TX, FL counter handling
// NEW: Zero-value field guidance (purchasePrice: 0 = extraction failure)

import classifierSchema from '@/forms/classifier.schema.json';
import extractorSchema from '@/forms/california/extractor.schema.json';
import universalExtractorSchema from '@/forms/universal/extractor.schema.json';

const classifierSchemaString = JSON.stringify(classifierSchema, null, 2);
const extractorSchemaString = JSON.stringify(extractorSchema, null, 2);
const universalExtractorSchemaString = JSON.stringify(universalExtractorSchema, null, 2);

import { RPA_FORM, COUNTER_OFFERS, KEY_ADDENDA } from './extract/form-definitions';

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
  * "transaction_terms" = fillable transaction data (price, deposit, dates, contingencies, financing)
  * "signatures" = signature blocks and acceptance dates
  * "broker_info" = agent contact information
  * "disclosures" = standard disclosure text
  * "boilerplate" = dense legal text with no substantive fillable fields
  * "other" = unknown/blank
- hasFilledFields: true if MAIN BODY has 3+ substantive filled fields (see rules above).

Special rules:
- If page is dense paragraph text with minimal fillable fields → contentCategory: "boilerplate", hasFilledFields: false
- formRevision: Extract exactly as visible; if unclear → null
- Prioritize footer for formCode, formRevision, formPage/totalPagesInForm

Return ONLY valid JSON matching this schema exactly. No other text.

${classifierSchemaString}
`.trim();
}

export const UNIVERSAL_EXTRACTOR_PROMPT = `
You are an expert U.S. real estate transaction analyst examining 5–15 high-resolution PNG images from a complete residential purchase packet.

These images have been automatically selected as the most critical pages containing transaction data (main contract, counters/addenda, signature pages).

Your task: Extract the FINAL accepted terms. If counters or addenda are present, they override earlier terms.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL: COUNTER OFFER & AMENDMENT HANDLING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Common U.S. real estate forms by state:
- California: RPA (main contract) + SCO/BCO/SMCO (counter offers) + ADM (addenda)
- Texas: TREC 20-16 (main contract) + TREC 39-9 (counter) + TREC 38-9 (amendment)
- Florida: FAR/BAR-6 (main contract) + FAR/BAR-5 (counter) + FAR/BAR-9 (amendment)
- Nevada: NVAR Purchase Agreement + NVAR Counter Offer
- Generic: Purchase Agreement + Counter Offer + Amendment

OVERRIDE RULES:
1. Counters and amendments OVERRIDE original contract terms
2. If counter says "Purchase Price revised to $510,000" → use 510000 (not original)
3. If counter says "Close of escrow extended to 45 days" → use 45 (not original 30)
4. If field NOT mentioned in counter → use original value (counter didn't change it)

EXAMPLES:

Example 1 (California RPA + SCO):
- RPA Page 1: Purchase Price $500,000, Deposit $10,000, Close 30 days
- SCO Page 1: Purchase Price $510,000, Close 45 days, Appraisal waived
→ Extract: purchasePrice: 510000, closingDate: "45", earnestMoney: 10000 (unchanged), appraisalDays: "Waived"

Example 2 (Texas TREC + Counter):
- TREC Page 1: Sales Price $425,000, Earnest Money $5,000, Closing Sept 30
- TREC 39-9: Sales Price $430,000, Earnest Money $7,500, Closing Oct 15, Option 5 days
→ Extract: purchasePrice: 430000, earnestMoney: 7500, closingDate: "2025-10-15", inspectionDays: 5

Example 3 (Florida FAR/BAR + Amendment):
- FAR/BAR-6: Purchase Price $650,000, Deposit $20,000, Closing 60 days
- FAR/BAR-9: Seller credit $5,000, Inspection extended to 20 days
→ Extract: purchasePrice: 650000 (unchanged), earnestMoney: 20000 (unchanged), closingDate: "60" (unchanged), sellerCredit: 5000 (new), inspectionDays: 20 (amended)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

KEY EXTRACTION RULES:

1. Handwriting Detection:
   - ONLY set handwriting_detected: true if you see actual pen/ink handwriting
   - Digital signatures, typed text, DocuSign = NOT handwriting

2. Checkbox Reading:
   - Checked = ✓, X, filled, shaded, darkened, or text inside
   - Unchecked = empty, blank
   - If unsure → default to unchecked

3. Zero Values = Extraction Failure:
   - purchasePrice: 0 means extraction FAILED (try harder to find the price)
   - If truly $0, there will be text like "No purchase price" or "Land lease only"
   - Otherwise, purchasePrice > 0 is ALWAYS required

4. Confidence Scores (REQUIRED):
   - Provide confidence: 0-100 for EVERY major field
   - Lower confidence if: handwriting, blurry, ambiguous, multiple counters
   - Example: { "confidence": { "overall_confidence": 92, "purchasePrice": 95, "buyerNames": 88 } }

5. Null Handling:
   - If field is blank → null
   - If field has value → extract it
   - Do NOT hallucinate data

Return ONLY valid JSON exactly matching this schema. No explanations, no markdown.

${universalExtractorSchemaString}

Images (critical pages only):
`.trim();

export const EXTRACTOR_PROMPT = `
You are an expert California real estate transaction analyst examining 5-10 high-resolution PNG images from a single transaction packet.

Each image is labeled with its exact role, e.g.:
- "RPA PAGE 1 OF 17 (ADDRESS, PRICE, FINANCING & CLOSING)"
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

Return ONLY valid JSON that strictly matches this exact schema.
NO explanatory text. NO markdown code blocks. Start with { and end with }.

${extractorSchemaString}

Extract from the labeled images below:`.trim();

export const SECOND_TURN_PROMPT = `The previous extraction had low confidence or detected handwriting.

Re-examine ONLY the pages shown below with EXTREME CARE.

Previous result (for context only - DO NOT COPY VALUES blindly):
{{PREVIOUS_JSON}}

Focus on:
- Fields with confidence < 80 in previous extraction
- Any checkboxes that might have been misread
- Handwriting vs digital signatures distinction
- Property address if it was empty (ALWAYS present on Page 1)
- Exact capitalization for enums
- Full names without truncation
- ZERO VALUES: If purchasePrice was 0, you MUST find the actual price

Return ONLY valid JSON matching the same schema as the main extractor prompt.

${extractorSchemaString}`.trim();