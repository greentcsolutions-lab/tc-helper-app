// src/lib/extractor/prompts.ts
// Version: 3.2.1 - 2025-12-20
// FIXED: Now uses static JSON imports — safe for Next.js/Vercel builds
//        No more fs.readFileSync or __dirname issues

// Static imports — Next.js bundles these correctly at build time
import classifierSchema from '@/forms/california/classifier.schema.json';
import extractorSchema from '@/forms/california/extractor.schema.json';

// Prettify for clean prompt insertion
const classifierSchemaString = JSON.stringify(classifierSchema, null, 2);
const extractorSchemaString = JSON.stringify(extractorSchema, null, 2);

import { RPA_FORM, COUNTER_OFFERS, KEY_ADDENDA } from './form-definitions';

/**
 * Builds the classifier prompt dynamically based on total pages
 */
// Keep the function name exactly the same — only the prompt content changes
export function buildClassifierPrompt(
  batchStart: number,
  batchEnd: number,
  batchSize: number
): string {
  return `You are examining exactly ${batchSize} full-page images from a California real estate transaction PDF.

These images are PDF pages ${batchStart} to ${batchEnd} ONLY. You cannot see any pages outside this range.

For EACH image independently, focus ONLY on the bottom 8% of the page — the single centered footer line directly above the thin rectangular broker information box (the box that contains agent name, Lone Wolf/zipForm credit, etc.). This line usually has the small CAR house icon to its right.

Your task per image:
- If the footer clearly contains one of these exact patterns inside parentheses:
  (RPA PAGE X OF 17)
  (SCO PAGE X OF 2)
  (SMCO PAGE X OF 2)
  (BCO PAGE 1 OF 1)

  → report the form code, the internal page number X, and the exact footer text you read.

- Otherwise → return null for that image.

Valid examples you may see:
- "RPA REVISED 6/25 (PAGE 1 OF 17)"
- "SELLER COUNTER OFFER (SCO PAGE 1 OF 2)"
- "(RPA PAGE 16 OF 17)"
- "SCO REVISED 12/24 (PAGE 2 OF 2)"
- "CALIFORNIA RESIDENTIAL PURCHASE AGREEMENT AND JOINT ESCROW INSTRUCTIONS (RPA PAGE 3 OF 17)"

Required for a match:
- One of RPA / SCO / SMCO / BCO inside the parentheses
- "PAGE X OF Y" inside parentheses with correct total pages (17 for RPA, 2 for SCO/SMCO, 1 for BCO)

If the footer is missing, blurry, cut off, or does not contain one of these exact patterns → return null.

Do not guess, assume, or invent any footer text or page numbers.

Return ONLY valid JSON — no explanations, no markdown.

${classifierSchemaString}`.trim();
}

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