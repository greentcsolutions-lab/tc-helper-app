// src/lib/extraction/prompts/second-turn-prompt.ts
// Version: 6.0.0 - 2025-12-29
// Second-turn prompt for re-extraction when confidence is low or handwriting detected

import extractorSchema from '@/forms/california/extractor.schema.json';

const extractorSchemaString = JSON.stringify(extractorSchema, null, 2);

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