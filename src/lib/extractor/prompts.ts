// src/lib/extractor/prompts.ts
// Version: 3.2.1 - 2025-12-20
// FIXED: Now uses static JSON imports — safe for Next.js/Vercel builds
//        No more fs.readFileSync or __dirname issues

// Static imports — Next.js bundles these correctly at build time
import classifierSchema from '../../../forms/california/classifier.schema.json';
import extractorSchema from '../../../forms/california/extractor.schema.json';

// Prettify for clean prompt insertion
const classifierSchemaString = JSON.stringify(classifierSchema, null, 2);
const extractorSchemaString = JSON.stringify(extractorSchema, null, 2);

import { RPA_FORM, COUNTER_OFFERS, KEY_ADDENDA } from './form-definitions';

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

Return ONLY valid JSON that strictly matches this schema (no markdown, no extra text):

${classifierSchemaString}

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

export const EXTRACTOR_PROMPT = `
You are an expert California real estate transaction analyst examining 5-10 high-resolution PNG images from a single transaction packet.

Each image is labeled with its exact role, e.g.:
- "RPA PAGE 1 OF 17"
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