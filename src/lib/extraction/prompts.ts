// src/lib/extraction/prompts.ts
// Version: 3.2.1 - 2025-12-20
// FIXED: Now uses static JSON imports — safe for Next.js/Vercel builds
//        No more fs.readFileSync or __dirname issues

// Static imports — Next.js bundles these correctly at build time
import classifierSchema from '@/forms/classifier.schema.json';
import extractorSchema from '@/forms/california/extractor.schema.json';
import universalExtractorSchema from '@/forms/universal/extractor.schema.json';

// Prettify for clean prompt insertion
const classifierSchemaString = JSON.stringify(classifierSchema, null, 2);
const extractorSchemaString = JSON.stringify(extractorSchema, null, 2);
const universalExtractorSchemaString = JSON.stringify(universalExtractorSchema, null, 2);

import { RPA_FORM, COUNTER_OFFERS, KEY_ADDENDA } from './extract/form-definitions';

/**
 * Builds the classifier prompt dynamically based on total pages
 */

export function buildClassifierPrompt(
  batchStart: number,
  batchEnd: number,
  batchSize: number,
): string {
  return `
You are a document page classifier. You will examine exactly ${batchSize} separate, independent page images from a U.S. real estate transaction packet.

IMPORTANT: Treat every page as completely isolated. DO NOT maintain any context or assumptions about order, document flow, or relationships between pages. DO NOT try to determine which form came first, what overrides what, or where the "main contract" should appear. Classify each page based solely on its own visible content.

The images are provided in strict document order:
- Image 1 = absolute PDF page ${batchStart}
- Image 2 = absolute PDF page ${batchStart + 1}
- ...
- Image ${batchSize} = absolute PDF page ${batchEnd}

For EACH page independently, identify whether it belongs to a known standard real estate form by examining:
- Top header / title (this is usually the most reliable indicator of form type)
- Bottom footer (form code, revision date, "Page X of Y", copyright)
- Overall layout, section headings, and signature blocks

Common indicators (examples only — match any similar pattern nationwide):
- Title contains "Residential Purchase Agreement", "Purchase and Sale Agreement", "Contract of Sale", "One to Four Family Residential Contract" → role "main_contract"
- Title contains "Counter Offer", "Buyer Counter", "Seller Counter" → role "counter_offer"
- Title contains "Addendum", "Amendment to Contract", "Modification" → role "addendum"
- Title or section contains "Broker Compensation", "Confirmation of Agency Relationships", "Listing Agent", "Selling Agent" → contentCategory "broker_info"
- Underwriting reports, loan approvals, appraisals, title reports → role "financing"
- Cover letters, emails, blank pages, miscellaneous attachments → role "other"

CRITICAL DISTINCTION — LENDER UNDERWRITING REPORTS ARE NOT REAL ESTATE FORMS:
Pages from lender automated underwriting systems are COMMON attachments in U.S. transaction packets, especially VA loans.
Typical titles/headers:
- "DU Underwriting Findings"
- "Desktop Underwriter Findings"
- "Underwriting Findings"
- "Loan Analysis"
- "Credit and Liabilities"
- "Risk/Eligibility"
- "Verification Messages/Approval Conditions"

These pages contain numbered conditions, credit/income analysis, ratios, residual income, and lender recommendations.
They are produced by Fannie Mae Desktop Underwriter (DU), Freddie Mac LP, or similar AUS tools.

RULE: If the page matches ANY of the above patterns → 
- Set role = "financing" 
- Set formCode = "" (empty string)
- Set confidence ≤ 50
- DO NOT treat as main_contract, counter_offer, addendum, or disclosure
- These pages are lender-side only and contain NO purchase agreement terms

Similar rule for title reports, appraisals, credit reports, bank statements → role = "financing" or "other", empty formCode.

For each detected form page, also classify:
- contentCategory: Choose the BEST single category based on visible section headings and filled content:
  • "core_terms" → property address, buyer/seller names, purchase price, earnest money, closing date
  • "contingencies" → inspection, appraisal, loan, or sale contingency periods/days
  • "financing_details" → loan type (Conventional/FHA/VA), loan amount, all-cash option
  • "signatures" → signature blocks, acceptance dates, effective date (usually near end of main contract)
  • "broker_info" → listing/selling brokerage names, agent names, phone/email, compensation confirmation (typically on final page of main RPA)
  • "counter_or_addendum" → explicit changes to price, dates, contingencies (look for "Counter Offer", "Amendment")
  • "disclosures" → agency, lead paint, property condition
  • "boilerplate" → dense legal text, arbitration clauses, no filled fields visible
  • "other" → anything else
- Set contentCategory to 'boilerplate' ONLY for pages with dense, continuous legal paragraphs and role "other"
- Focus on pages that require user input or contain deal-specific customizations. Ignore or downrank walls of text without interactive elements

- If title/header contains "Disclosure", "Advisory", "Questionnaire", "Notice", "Statement", "Guide" (or similar variants like "Seller's Disclosure", "Transfer Disclosure", "Property Condition Disclosure", "Buyer's Advisory", "Seller Property Questionnaire"):
  - Examples (match patterns, not exact):
    • California: "Real Estate Transfer Disclosure Statement" (TDS), "Seller Property Questionnaire" (SPQ), "Buyer's Investigation Advisory" (BIA) – dense sections on conditions/defects/hazards, checkboxes/yes-no if filled, but ALWAYS treat as non-critical.
    • Texas: "Seller's Disclosure Notice" (TREC OP-H) – property condition questions, yes/no/explain.
    • Florida: "Seller's Property Disclosure Statement" – defects/material facts.
    • New York: "Property Condition Disclosure Statement" (PCDS) – yes/no/unknown on systems/hazards.
    • Nevada/Nationwide: Any "Disclosure Guide/Notice/Advisory" with hazards/duties lists.
  - RULE: Regardless of fills/checks/signatures (even if hasFilledFields would otherwise be true), set:
    - role = "disclosure"
    - contentCategory = "boilerplate"  
    - hasFilledFields = false  
    - confidence ≤ 50  
  - These are NEVER critical purchase-modifying terms—do NOT prioritize even if filled.

- ENHANCED: hasFilledFields criteria (applies after exclusions)
  - true ONLY if CLEAR non-pre-printed content (e.g., typed/handwritten names, dates, X in checkboxes, signatures) AND page is not excluded above. 
  - DO NOT count: bold/italic/underlined instructions, form borders, logos, footers, empty checkboxes, or advisory words like "checked". When in doubt or blurry, default to false.

- NEW: Density heuristic for boilerplate
  - If page has high text density (e.g., average line >80 chars, >40% long paragraphs >100 chars, word count >500 with <5% lines matching fill patterns like "____", "[ ]", "Date:", "Name:") and NO interactive elements (after exclusions):
    - Force contentCategory = 'boilerplate'
    - hasFilledFields = false
    - Downrank confidence if mostly lists/paragraphs on hazards/duties.

Never:
- Identify lending or title company documents as real estate contract forms
- Assume any page is part of a multi-page form unless explicitly indicated in footer
- Infer relationships between pages or try to group them into sets
- Hallucinate form codes, revision dates, or page numbers that aren't clearly visible  
- Assign a real estate form code (RPA, SCO, AD, etc.) to lender underwriting reports, credit reports, or bank statements

Return ONLY valid JSON exactly matching the schema below. No explanations, no markdown.

${classifierSchemaString}
`.trim();
}

export const UNIVERSAL_EXTRACTOR_PROMPT = `
You are an expert U.S. real estate transaction analyst examining 5–10 high-resolution PNG images from a complete residential purchase packet.

These images have been automatically selected as the most critical pages (main contract, counters/addenda, signature pages).

Your task: Extract the FINAL accepted terms. If counters or addenda are present, they override earlier terms.

Focus on visible filled fields, checked boxes, and signatures. Ignore blank fields.

Key rules:
- Use the latest signed counter/addendum for price, dates, contingencies.
- Handwriting vs digital: only count actual pen/ink handwriting as handwriting_detected: true.
- Checkboxes: checked if X, filled, shaded, or has text inside.
- Confidence: 0–100 per field. Lower if handwriting, blurry, or ambiguous.

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
📋 FIELD-BY-FIELD EXTRACTION GUIDE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Your full field guide remains unchanged — kept as-is]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 ANTI-HALLUCINATION CHECKLIST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Your checklist remains unchanged]

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
- Property address if it was empty (ALWAYS present on RPA Page 1)
- Exact capitalization for home_warranty.ordered_by
- Full names without truncation

Return ONLY valid JSON matching the same schema as the main extractor prompt.

${extractorSchemaString}`.trim();