// src/lib/extraction/shared/extraction-schema.ts
// Version: 1.0.0 - 2026-01-15
// Shared extraction schema used by ALL AI providers (Claude, Gemini, etc.)
// This ensures consistent extraction regardless of which AI is used

/**
 * JSON Schema for structured contract extraction
 * Used by all AI providers to ensure consistent output format
 */
export const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    extracted: {
      type: "object",
      properties: {
        buyer_names: { type: "array", items: { type: "string" }, minItems: 1 },
        property_address: {
          type: "object",
          properties: { full: { type: "string" } },
          required: ["full"]
        },
        purchase_price: {
          type: "string",
          pattern: "^\\$\\d{1,3}(,\\d{3})*(\\.\\d{2})?$"
        },
        all_cash: { type: "boolean" },
        loan_type: { type: ["string", "null"] },
        loan_type_note: { type: ["string", "null"] },
        seller_credit_to_buyer: { type: ["string", "null"] },
        cop_contingency: { type: "boolean" },
        home_warranty: {
          type: "object",
          properties: {
            ordered_by: { type: ["string", "null"], enum: ["Buyer", "Seller", "Both", "Waived", null] },
            seller_max_cost: { type: ["string", "null"] },
            provider: { type: ["string", "null"] }
          }
        },
        final_acceptance_date: {
          type: "string",
          pattern: "^\\d{2}/\\d{2}/\\d{4}$"
        },
        timeline_events: {
          type: "array",
          items: {
            type: "object",
            properties: {
              event_key: { type: "string" },
              display_name: { type: "string" },
              date_type: { type: "string", enum: ["specified", "relative"] },
              specified_date: { type: ["string", "null"] },
              relative_days: { type: ["integer", "null"], minimum: 0 },
              anchor_point: { type: ["string", "null"] },
              direction: { type: ["string", "null"], enum: ["after", "before", null] },
              day_type: { type: ["string", "null"], enum: ["calendar", "business", null] },
              description: { type: ["string", "null"] }
            },
            required: ["event_key", "display_name", "date_type"]
          },
          minItems: 1
        },
        counters: {
          type: "object",
          properties: {
            has_counter_or_addendum: { type: "boolean" },
            counter_chain: { type: "array", items: { type: "string" } },
            final_version_page: { type: ["integer", "null"] },
            summary: { type: "string" }
          },
          required: ["has_counter_or_addendum", "counter_chain", "summary"]
        },
        buyers_broker: {
          type: "object",
          properties: {
            brokerage_name: { type: ["string", "null"] },
            agent_name: { type: ["string", "null"] },
            email: { type: ["string", "null"] },
            phone: { type: ["string", "null"] }
          }
        },
        sellers_broker: {
          type: "object",
          properties: {
            brokerage_name: { type: ["string", "null"] },
            agent_name: { type: ["string", "null"] },
            email: { type: ["string", "null"] },
            phone: { type: ["string", "null"] }
          }
        }
      },
      required: [
        "buyer_names", "property_address", "purchase_price", "all_cash",
        "final_acceptance_date", "timeline_events", "cop_contingency",
        "home_warranty", "counters", "buyers_broker", "sellers_broker"
      ]
    },
    confidence: {
      type: "object",
      properties: {
        overall_confidence: { type: "integer", minimum: 0, maximum: 100 },
        purchase_price: { type: "integer", minimum: 0, maximum: 100 },
        property_address: { type: "integer", minimum: 0, maximum: 100 },
        buyer_names: { type: "integer", minimum: 0, maximum: 100 },
        timeline_events: { type: "integer", minimum: 0, maximum: 100 },
        final_acceptance_date: { type: "integer", minimum: 0, maximum: 100 },
        home_warranty: { type: "integer", minimum: 0, maximum: 100 },
        brokerage_info: { type: "integer", minimum: 0, maximum: 100 },
        loan_type: { type: "integer", minimum: 0, maximum: 100 }
      },
      required: [
        "overall_confidence", "purchase_price", "property_address", "buyer_names",
        "timeline_events", "final_acceptance_date", "home_warranty",
        "brokerage_info", "loan_type"
      ]
    },
    handwriting_detected: { type: "boolean" }
  },
  required: ["extracted", "confidence", "handwriting_detected"]
} as const;

/**
 * Extraction prompt used by all AI providers
 * This ensures consistent extraction instructions regardless of which AI is used
 */
export function getExtractionPrompt(schemaJson: string): string {
  return `You will be extracting structured information from a Real Estate PDF document (typically a purchase contract) and outputting it as JSON that matches a specific schema. This task requires careful attention to detail and proper handling of amendments/counters that may override original contract terms.

Here is the JSON schema that your output must match:

<schema>
${schemaJson}
</schema>

Your task is to extract ALL fields specified in the schema with particular focus on:
- Buyer and seller names
- Property address
- Purchase price
- Final acceptance date (also called effective date) - this must be a SPECIFIC date in MM/DD/YYYY format
- Timeline events (ALL dates/deadlines found in the contract)
- Broker contact information

Follow these extraction rules:

**Override Logic for Counters and Addenda:**
- Counters and addenda ONLY override contract terms if they explicitly mention those specific terms
- If a counter or addendum does not mention a particular field, use the value from the original contract
- When merging information from multiple pages, apply this override logic carefully
- Last counter/addendum wins for any field it explicitly modifies

**CRITICAL: Timeline Events Extraction (NEW)**
Extract EVERY timeline event found in the contract. For each event, you must identify HOW the date is set, not calculate the actual date.

For each timeline event, extract:
- event_key: A unique identifier (e.g., "initialDeposit", "sellerDisclosures", "inspectionContingency", "closing")
- display_name: Human-readable name (e.g., "Initial Deposit Due", "Seller Delivery of Disclosures")
- date_type: Either "specified" (exact date given) or "relative" (calculated from another date)

If date_type is "specified":
- specified_date: Extract the EXACT date as written (MM/DD/YYYY or YYYY-MM-DD)

If date_type is "relative":
- relative_days: The number of days (e.g., 3, 7, 17, 30)
- anchor_point: What the date is relative to (e.g., "acceptance", "closing", "sellerDisclosures")
- direction: Either "after" or "before"
- day_type: Either "business" or "calendar" (look for keywords like "business days" in contract)
  - If contract says "business days", use "business"
  - If contract just says "days" or doesn't specify, use "calendar"

Common timeline events to extract (but extract ALL you find):
- acceptance: The effective date (ALWAYS "specified", from final_acceptance_date)
- initialDeposit: When initial/earnest money deposit is due
- sellerDisclosures: When seller must deliver disclosures
- buyerReviewPeriod: If buyer has review period after receiving disclosures
- inspectionContingency: Inspection contingency removal deadline
- appraisalContingency: Appraisal contingency removal deadline
- loanContingency: Loan contingency removal deadline
- closing: Close of escrow date

**IMPORTANT**: Some events may be relative to OTHER timeline events (not just acceptance or closing).
Example: "Buyer has 5 days to review after seller delivers disclosures" means anchor_point is "sellerDisclosures"

**IMPORTANT**: DO NOT calculate any dates. Only identify the structure.
- BAD: "30 days after 01/15/2026 is 02/14/2026" ❌
- GOOD: { date_type: "relative", relative_days: 30, anchor_point: "acceptance", direction: "after", day_type: "calendar" } ✓

**Field-Specific Instructions:**
- Prices: Include the dollar sign and format with commas (e.g., $500,000)
- final_acceptance_date: Must be the last signature date (MM/DD/YYYY format)
- Be state-agnostic: Extract ALL timeline events regardless of state
- Better to extract MORE timeline events than miss some

**Response Format:**

Your response should contain two parts:

1. **Working/Reasoning** (optional but recommended):
   - Briefly note which pages contain which information
   - Track which fields are mentioned in counters/addenda vs original contract
   - Identify timeline events and how each date is calculated
   - Note any events that depend on other timeline events
   - Reason through any ambiguities or conflicts
   - Map extracted information to schema fields
   - Keep this section concise (a few bullet points per topic is sufficient)

2. **Final JSON Output** (required):
   Provide the complete extraction result as valid JSON matching the schema above.

   You may format the JSON output using any of these methods:
   - XML-style tags: <json>{ ... }</json>
   - Markdown code block: ```json\n{ ... }\n```
   - Plain JSON object starting with {

   The JSON must:
   - Be valid, parseable JSON
   - Match the exact structure of the provided schema
   - Include all required fields from the schema
   - Use null for any fields that cannot be found in the document
   - Extract ALL timeline events with their calculation structure (no date calculations!)`;
}
