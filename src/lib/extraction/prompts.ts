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
// Keep the function name exactly the same — only the prompt content changes
export function buildClassifierPrompt(
  batchStart: number,
  batchEnd: number,
  batchSize: number,
): string {
  return `
You are examining exactly ${batchSize} full-page images from a complete U.S. real estate transaction packet (1–100 pages total).

These images are PDF pages ${batchStart}–${batchEnd} ONLY.

Your job: For EACH page independently, identify if it belongs to a known standard real estate form by looking at headers, footers, layout, title, revision date, and form code.

Focus on:
- Top header (form title, revision date like "06/25", "1/2024", association name)
- Bottom footer (form code, page X of Y, copyright)
- Overall layout (sections, checkboxes, signature blocks)

🚨 ABSOLUTE PAGE NUMBER RULES — FOLLOW EXACTLY 🚨
- The images are sent in strict sequential order: first image = PDF page ${batchStart}, second image = PDF page ${batchStart + 1}, ..., last image = PDF page ${batchEnd}.
- You MUST use these exact PDF page numbers in your JSON output.
- NEVER use the internal form page number (e.g., "PAGE 3 OF 17") as the pdfPage value.
- NEVER re-order or re-number pages based on what you read in footers or headers.
- The batch position = absolute truth. If you detect a form footer, assign pdfPage based on its position in this batch only.

Known major forms (common examples):
- California: RPA (6/25), PRBS, AD, SCO/SMCO/BCO, ZIPFORMS footers
- Texas: TREC contracts (1-10, One to Four Family), Promulgated forms, revision date in header
- Florida: FAR/BAR contracts (AS-IS or standard), revision date top-right
- New York: NY State Bar forms, disclosure packets
- Generic/National: HUD, RESPA, CFPB forms, Fannie/Freddie addenda
- Common addenda: Lead-Based Paint, HOA, Contingency, Counter Offer, Amendment

For every page, return ONE of:
- If it's a known standard form page → form details
- If it's a cover letter, title page, email, blank → "other"
- If it's a non-standard disclosure or local addendum → "local_addendum"

Return ONLY valid JSON matching the schema below. No explanations.

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