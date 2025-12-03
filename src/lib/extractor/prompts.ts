// src/lib/extractor/prompts.ts
/**
 * All static prompts are now pure TS exports.
 * Zero fs calls → cold-start safe, tree-shakable, and type-checkable.
 * We keep them as template literals so we can still do .replace() for batch numbers.
 */

export const CLASSIFIER_PROMPT = `You are an expert U.S. real estate document classifier.

You are looking at batch {{BATCH}} of {{TOTAL}} (pages {{START}}–{{END}}) from a complete real estate transaction packet.

Identify the U.S. state and the FINAL accepted version of every key section.
Counters, addenda, and handwritten changes, and latest signatures override everything earlier.

Return ONLY this exact JSON format. No extra text, no markdown.

{
  "state": "California",
  "critical_pages": [
    { "type": "main_contract", "page": 8 },
    { "type": "purchase_price", "page": 38 },
    { "type": "buyer_names", "page": 3 },
    { "type": "seller_names", "page": 3 },
    { "type": "property_address", "page": 3 },
    { "type": "counter_or_addendum", "page": 38 },
    { "type": "disclosures", "page": 45 },
    { "type": "contingency_dates", "page": 38 }
  ]
}`.trim();

export const EXTRACTOR_PROMPT = `Extract EXACTLY these fields from the FINAL ACCEPTED version of the contract.

Counters and addenda override the original.
Handwriting overrides typed text.
Use the latest dated/signed version.

Return ONLY valid JSON matching this schema exactly. Include confidence 0–100 for every field.

{
  "extracted": {
    "state": "California",
    "purchase_price": 1250000,
    "buyer_names": ["John Doe", "Jane Doe"],
    "seller_names": ["Robert Smith"],
    "property_address": "123 Main St, Los Angeles, CA 90210",
    "closing_date": "2025-12-15",
    "contingency_removal_date": "2025-11-20",
    "loan_amount": 1000000,
    "down_payment": 250000
  },
  "confidence": {
    "purchase_price": 100,
    "buyer_names": 98,
    "seller_names": 100,
    "property_address": 100,
    "closing_date": 95,
    "overall_confidence": 97
  },
  "handwriting_detected": false
}`.trim();

export const SECOND_TURN_PROMPT = `The previous extraction had low confidence or detected handwriting.

Re-examine ONLY the pages shown below with extreme care.
Handwriting overrides everything.
Return the exact same JSON schema as before, but with updated values and new confidence scores.

Previous result (for context only, do NOT copy blindly):
{{PREVIOUS_JSON}}

Now correct and return the final JSON:`;