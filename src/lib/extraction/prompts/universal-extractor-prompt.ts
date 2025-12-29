// src/lib/extraction/prompts/universal-extractor-prompt.ts
// Version: 6.0.0 - 2025-12-29
// Universal extractor prompt for all U.S. states (CA, TX, FL, NV, etc.)

import universalExtractorSchema from '@/forms/universal/extractor.schema.json';

const universalExtractorSchemaString = JSON.stringify(universalExtractorSchema, null, 2);

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