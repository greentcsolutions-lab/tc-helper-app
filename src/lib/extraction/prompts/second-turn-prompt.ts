// src/lib/extraction/prompts/second-turn-prompt.ts
// Version: 7.0.0 - 2025-12-30
// FIXED: Added explicit property address extraction guidance for second-turn
// Second-turn prompt for re-extraction when confidence is low or validation fails

import extractorSchema from '@/forms/universal/extractor.schema.json';

const extractorSchemaString = JSON.stringify(extractorSchema, null, 2);

export const SECOND_TURN_PROMPT = `The previous extraction had validation errors or low confidence fields.

Re-examine ONLY the pages shown below with EXTREME CARE and FOCUSED ATTENTION.

Previous result (for context only - DO NOT COPY VALUES blindly):
{{PREVIOUS_JSON}}

Problem fields that need fixing:
{{PROBLEM_FIELDS}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 SPECIAL FOCUS: PROPERTY ADDRESS (If missing from first turn)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

If propertyAddress was null or missing in the previous extraction, this is a CRITICAL ERROR.
Property addresses appear on 95%+ of real estate contract pages.

WHERE TO LOOK (systematic search):

1. **TOP 20% OF PAGE** (Most common location):
   - Look for table/grid in header area
   - Look for labels: "Property:", "Property Address:", "Subject Property:", "Address:", "Re:", "Located at:"
   - May be in smaller font above main form title
   - May be split across two lines
   - Common on SCO (Seller Counter Offer), BCO (Buyer Counter Offer), and ADM (Addendum) pages

2. **FIRST SECTION OF MAIN BODY**:
   - Section labeled "PROPERTY" or "SUBJECT PROPERTY"
   - Fill-in field near top
   - May have box/line for address entry

3. **PAGE MARGINS AND CORNERS**:
   - Sometimes in top-left or top-right corner
   - May appear rotated or in margin notes
   - Check VERY carefully

4. **"RE:" LINES** (Common on addenda/counter offers):
   - Look for "Re: [property address]"
   - Format: "Re: 123 Main St, City, ST 12345"
   - Usually appears between header and main body

EXTRACTION REQUIREMENTS:
✅ Extract COMPLETE address: street, city, state, ZIP
✅ Format: "123 Main Street, Los Angeles, CA 90210"
✅ Include unit/apt numbers if present
✅ Preserve capitalization
✅ If you see ANY property address → extract it
✅ Only return null if page is completely blank or pure signature block with NO property reference

⚠️ SECOND-TURN REMINDER: If you missed it in the first turn, you probably weren't looking
hard enough in the header area. The property address is almost ALWAYS there.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OTHER FOCUS AREAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For other problem fields identified above:

- **Purchase Price = $0**: This is ALWAYS an error. Look for "Purchase Price:", "Sales Price:", or "Contract Price:" and extract the actual dollar amount. If you cannot find it, return null (don't return 0).

- **Low confidence fields (<80)**: Re-examine with extra scrutiny:
  * Check checkboxes more carefully (filled vs empty)
  * Verify numerical values (don't round or estimate)
  * Double-check date formats
  * Distinguish handwriting from digital signatures

- **Handwriting detection**: Only mark handwriting_detected: true if you see ACTUAL pen/ink handwritten script. Digital signatures, typed text, and e-signatures are NOT handwriting.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Return ONLY valid JSON matching the same schema as the main extractor prompt.
Your response must be a JSON array with one object per page.
NO explanatory text. NO markdown. Just the JSON array.

${extractorSchemaString}`.trim();