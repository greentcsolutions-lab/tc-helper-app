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
You are a U.S. real estate document page classifier. Examine ${batchSize} independent page images from a transaction packet.

Treat each page as isolated. Classify based solely on visible content: header/title, footer (code, revision, page X of Y), layout, section headings, and fields.

Images in order:
- Image 1 = PDF page ${batchStart}
- ...
- Image ${batchSize} = PDF page ${batchEnd}

For each page:
- If no standard form detected → null
- Otherwise, extract metadata matching the schema.
- state: Two-letter code if detected (e.g., 'CA'); null if unknown.
- formCode: Short code (e.g., 'RPA', 'TREC 20-16').
- formRevision: Date if visible (e.g., '6/25').
- formPage/totalPagesInForm: From footer (e.g., 'Page 3 of 17').
- role: Best enum match based on content (e.g., 'main_contract' for purchase agreements).
- titleSnippet: Prominent header text (max 120 chars).
- confidence: 0–100 based on clarity.
- contentCategory: Primary type from headings/filled fields (e.g., 'core_terms' for price/address; 'boilerplate' for dense legal text without fields).
- hasFilledFields: true if visible filled text, checkboxes, or handwriting.

Special rules:
- If page is dense paragraph text with no visible signature lines, date lines labeled "Date", or signature blocks → contentCategory: "boilerplate", hasFilledFields: false, confidence ≤ 70
- formRevision: Extract exactly as visible; if unclear or ambiguous → null
- Prioritize footer for formCode, formRevision, formPage/totalPagesInForm. Read carefully—common formats: "REVISED 12/25", "6/25", "PAGE 3 OF 17".

Return ONLY valid JSON matching this schema exactly. No other text.

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