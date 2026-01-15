// src/lib/extraction/claude/extractPdf.ts
// Version: 2.0.0 - 2026-01-15
// BREAKING: Reworked timeline extraction to use structured format
// AI now extracts HOW dates are calculated (relative vs specified) without performing calculations

import { coerceNumber, coerceString } from '@/lib/grok/type-coercion';
import { normalizeDateString } from '@/lib/extraction/extract/universal/helpers/date-utils';
import type { AITimelineExtraction } from '@/types/timeline';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;
if (!ANTHROPIC_API_KEY) {
  throw new Error('ANTHROPIC_API_KEY is required');
}

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01'; // Update if Anthropic releases a newer version

// ── Quick availability check ─────────────────────────────────────────────────
async function checkClaudeAvailability(modelName: string, timeoutMs = 5000): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        max_tokens: 1,
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: 'Ping',
          },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '(no details)');
      throw new Error(`Ping failed: ${response.status} - ${errorText}`);
    }

    return true;
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.warn(`[claude-check] Availability check failed: ${err.message}`);
    throw err;
  }
}

// ── Main extraction function ────────────────────────────────────────────────
export async function extractWithClaude(
  pdfUrl: string,
  totalPages: number,
  modelName: string = 'claude-haiku-4-5-20251001'
): Promise<{
  finalTerms: any;
  needsReview: boolean;
  criticalPages: string[];
  allExtractions: any[];
  modelUsed: string;
}> {
  console.log(`[claude-extract] Starting extraction for ${totalPages}-page document using model: ${modelName}`);
  console.log(`[claude-extract] PDF URL: ${pdfUrl}`);

  // Define schema and prompt INSIDE the function to avoid top-level evaluation issues
  const EXTRACTION_SCHEMA = {
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
            pattern: "^\\$$   \\d{1,3}(,\\d{3})*(\\.\\d{2})?   $$"
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
  };

  const EXTRACTION_PROMPT = `You will be extracting structured information from a Real Estate PDF document (typically a purchase contract) and outputting it as JSON that matches a specific schema. This task requires careful attention to detail and proper handling of amendments/counters that may override original contract terms.

Here is the JSON schema that your output must match:

<schema>
${JSON.stringify(EXTRACTION_SCHEMA, null, 2)}
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

**Processing Approach:**
Before providing your final JSON output, use the scratchpad to:
1. Identify all relevant sections (original contract, counters, addenda)
2. Extract values from each section
3. Apply override logic to determine final values
4. Identify ALL timeline events and their calculation structure
5. Verify all required schema fields are populated

<scratchpad>
Use this space to:
- Note which pages contain which information
- Track which fields are mentioned in counters/addenda vs original contract
- Identify timeline events and how each date is calculated
- Note any events that depend on other timeline events
- Reason through any ambiguities or conflicts
- Map extracted information to schema fields
</scratchpad>

Now provide your final output as valid JSON matching the schema. Your output must:
- Be valid, parseable JSON
- Match the exact structure of the provided schema
- Include all fields from the schema
- Use null for any fields that cannot be found in the document
- Extract ALL timeline events with their calculation structure (no date calculations!)

Your final response should contain ONLY the JSON output inside <json> tags, with no additional commentary or explanation outside those tags.`;

  // Now define the cached system block using the local variables
  const STATIC_SYSTEM_BLOCKS = [
    {
      type: 'text',
      text: EXTRACTION_PROMPT,
      cache_control: { type: 'ephemeral' } // 5-minute TTL, auto-refreshes on hits
      // For 1-hour TTL: { type: 'ephemeral', ttl: '1h' }
    }
  ];

  try {
    // Step 1: Quick availability check
    console.log(`[claude-extract] Quick availability check (max 5s)...`);
    await checkClaudeAvailability(modelName, 5000);
    console.log(`[claude-extract] Claude is responding ✓ Proceeding`);

    // Step 2: Fetch PDF
    console.log(`[claude-extract] Fetching PDF from URL...`);
    const pdfResponse = await fetch(pdfUrl);
    if (!pdfResponse.ok) {
      throw new Error(`Failed to fetch PDF: ${pdfResponse.status} ${pdfResponse.statusText}`);
    }
    const pdfBuffer = await pdfResponse.arrayBuffer();
    const pdfBase64 = Buffer.from(pdfBuffer).toString('base64');
    console.log(`[claude-extract] PDF fetched: ${(pdfBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`);

    console.log(`[claude-extract] Sending request with cached prompt to ${modelName}...`);

    const startTime = Date.now();

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        max_tokens: 4096,
        temperature: 0.1,
        system: STATIC_SYSTEM_BLOCKS,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: pdfBase64,
                },
              },
              {
                type: 'text',
                text: 'Extract structured data from this PDF according to the schema and rules. Use scratchpad for reasoning, then output ONLY the JSON inside <json> tags with no additional text.',
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Claude API error: ${response.status} - ${errorBody}`);
    }

    const result = await response.json();
    const durationMs = Date.now() - startTime;
    console.log(`[claude-extract] Response received after ${durationMs}ms`);

    // Log cache usage
    console.log('[claude-extract] Usage stats:', JSON.stringify(result.usage, null, 2));

    const text = result.content[0].text;
    console.log(`[claude-extract] Received response (${text.length} chars)`);

    // ── JSON extraction ──────────────────────────────────────────────────────
    let extractedData;
    try {
      const jsonMatch = text.match(/<json>([\s\S]*?)<\/json>/);
      if (!jsonMatch || !jsonMatch[1]) {
        throw new Error("No <json> block found in Claude response");
      }

      const jsonText = jsonMatch[1].trim();
      extractedData = JSON.parse(jsonText);

      console.log(`[claude-extract] Successfully extracted JSON`);
    } catch (parseError: any) {
      console.error(`[claude-extract] JSON extraction failed:`, parseError);
      console.error(`[claude-extract] Raw response preview:`, text.substring(0, 1200));
      throw new Error(`Failed to parse JSON: ${parseError.message}`);
    }

    console.log(`[claude-extract] Overall confidence: ${extractedData.confidence?.overall_confidence}%`);

    const finalTerms = transformToUniversal(extractedData);

    const needsReview =
      extractedData.confidence?.overall_confidence < 80 ||
      !extractedData.extracted?.buyer_names?.length ||
      !extractedData.extracted?.property_address?.full ||
      !extractedData.extracted?.purchase_price;

    console.log(`[claude-extract] Extraction complete - needsReview: ${needsReview}`);

    return {
      finalTerms,
      needsReview,
      criticalPages: ['1-' + totalPages],
      allExtractions: [extractedData],
      modelUsed: modelName,
    };
  } catch (error: any) {
    console.error(`[claude-extract] Error with ${modelName}:`, error);

    if (error.message.includes('Ping failed') || error.message.includes('AbortError')) {
      throw new Error(`Claude appears to be down or not responding right now`);
    }

    throw new Error(`Claude extraction failed (${modelName}): ${error.message}`);
  }
}

// ── Transform to universal format with structured timeline ─────────────────
function transformToUniversal(data: any): any {
  const e = data.extracted;

  const effectiveDate = normalizeDateString(e.final_acceptance_date) || e.final_acceptance_date;
  const purchasePrice = coerceNumber(e.purchase_price);
  const sellerCreditAmount = coerceNumber(e.seller_credit_to_buyer);

  console.log(`[claude-transform] Coerced purchasePrice: "${e.purchase_price}" → ${purchasePrice}`);
  console.log(`[claude-transform] Coerced sellerCredit: "${e.seller_credit_to_buyer}" → ${sellerCreditAmount}`);
  console.log(`[claude-transform] Normalized effectiveDate: "${e.final_acceptance_date}" → ${effectiveDate}`);

  // Transform timeline events to our structured format
  const timelineEventsStructured: Record<string, any> = {};

  if (e.timeline_events && Array.isArray(e.timeline_events)) {
    console.log(`[claude-transform] Processing ${e.timeline_events.length} timeline events`);

    for (const event of e.timeline_events) {
      const eventData: any = {
        dateType: event.date_type,
        effectiveDate: null, // Will be calculated later
      };

      if (event.date_type === 'specified' && event.specified_date) {
        eventData.specifiedDate = normalizeDateString(event.specified_date) || event.specified_date;
      } else if (event.date_type === 'relative') {
        eventData.relativeDays = event.relative_days;
        eventData.anchorPoint = event.anchor_point || 'acceptance';
        eventData.direction = event.direction || 'after';
        eventData.dayType = event.day_type || 'calendar';
      }

      if (event.display_name) {
        eventData.displayName = event.display_name;
      }

      if (event.description) {
        eventData.description = event.description;
      }

      timelineEventsStructured[event.event_key] = eventData;

      console.log(`[claude-transform] Timeline event "${event.event_key}": ${event.date_type}`, eventData);
    }
  }

  // For backwards compatibility, extract specific fields from timeline events
  let closeOfEscrowDate = null;
  let initialDepositDueDate = null;
  let sellerDeliveryOfDisclosuresDate = null;
  let contingencies = null;

  // Extract closing date
  if (timelineEventsStructured.closing) {
    if (timelineEventsStructured.closing.dateType === 'specified') {
      closeOfEscrowDate = timelineEventsStructured.closing.specifiedDate;
    } else {
      closeOfEscrowDate = `${timelineEventsStructured.closing.relativeDays} days after ${timelineEventsStructured.closing.anchorPoint}`;
    }
  }

  // Extract initial deposit
  if (timelineEventsStructured.initialDeposit) {
    if (timelineEventsStructured.initialDeposit.dateType === 'specified') {
      initialDepositDueDate = timelineEventsStructured.initialDeposit.specifiedDate;
    } else {
      initialDepositDueDate = `${timelineEventsStructured.initialDeposit.relativeDays} days`;
    }
  }

  // Extract seller disclosures
  if (timelineEventsStructured.sellerDisclosures) {
    if (timelineEventsStructured.sellerDisclosures.dateType === 'specified') {
      sellerDeliveryOfDisclosuresDate = timelineEventsStructured.sellerDisclosures.specifiedDate;
    } else {
      sellerDeliveryOfDisclosuresDate = `${timelineEventsStructured.sellerDisclosures.relativeDays} days`;
    }
  }

  // Extract contingencies from timeline events
  const inspectionDays = timelineEventsStructured.inspectionContingency?.relativeDays || null;
  const appraisalDays = timelineEventsStructured.appraisalContingency?.relativeDays || null;
  const loanDays = timelineEventsStructured.loanContingency?.relativeDays || null;

  if (inspectionDays || appraisalDays || loanDays) {
    contingencies = {
      inspectionDays,
      appraisalDays,
      loanDays,
      saleOfBuyerProperty: e.cop_contingency || false,
    };
  }

  // Find initial deposit amount from timeline events
  let earnestMoneyAmount = null;
  if (timelineEventsStructured.initialDeposit?.description) {
    const amountMatch = timelineEventsStructured.initialDeposit.description.match(/\$[\d,]+(?:\.\d{2})?/);
    if (amountMatch) {
      earnestMoneyAmount = coerceNumber(amountMatch[0]);
    }
  }

  return {
    buyerNames: e.buyer_names || [],
    sellerNames: [],
    propertyAddress: coerceString(e.property_address?.full),
    purchasePrice,
    closeOfEscrowDate,
    effectiveDate,
    initialDepositDueDate,
    sellerDeliveryOfDisclosuresDate,

    // NEW: Structured timeline data
    timelineDataStructured: timelineEventsStructured,

    earnestMoneyDeposit: earnestMoneyAmount ? {
      amount: earnestMoneyAmount,
      holder: null,
    } : null,

    financing: {
      isAllCash: e.all_cash,
      loanType: coerceString(e.loan_type),
      loanAmount: null,
    },

    contingencies,

    closingCosts: {
      buyerPays: [],
      sellerPays: [],
      sellerCreditAmount,
    },

    brokers: {
      listingBrokerage: coerceString(e.sellers_broker?.brokerage_name),
      listingAgent: coerceString(e.sellers_broker?.agent_name),
      listingAgentEmail: coerceString(e.sellers_broker?.email),
      listingAgentPhone: coerceString(e.sellers_broker?.phone),
      sellingBrokerage: coerceString(e.buyers_broker?.brokerage_name),
      sellingAgent: coerceString(e.buyers_broker?.agent_name),
      sellingAgentEmail: coerceString(e.buyers_broker?.email),
      sellingAgentPhone: coerceString(e.buyers_broker?.phone),
    },

    personalPropertyIncluded: null,
    escrowHolder: null,

    confidence: data.confidence,
    handwritingDetected: data.handwriting_detected,
    counters: e.counters,
  };
}
