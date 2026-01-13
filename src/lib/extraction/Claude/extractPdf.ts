// src/lib/extraction/claude/extractPdf.ts
// Version: 1.1.1 - 2026-01-13
// Fixed build error by moving schema + prompt inside function to avoid top-level evaluation issues

import { coerceNumber, coerceString } from '@/lib/grok/type-coercion';
import { normalizeDateString } from '@/lib/extraction/extract/universal/helpers/date-utils';

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
  modelName: string = 'claude-haiku-4-5-latest'
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
          close_of_escrow: { type: "string" },
          initial_deposit: {
            type: "object",
            properties: { amount: { type: "string" }, due: { type: "string" } },
            required: ["amount", "due"]
          },
          loan_type: { type: ["string", "null"] },
          loan_type_note: { type: ["string", "null"] },
          seller_credit_to_buyer: { type: ["string", "null"] },
          contingencies: {
            type: "object",
            properties: {
              loan_days: { type: "integer", minimum: 0 },
              appraisal_days: { type: "integer", minimum: 0 },
              investigation_days: { type: "integer", minimum: 0 },
              crb_attached_and_signed: { type: "boolean" }
            },
            required: ["loan_days", "appraisal_days", "investigation_days", "crb_attached_and_signed"]
          },
          cop_contingency: { type: "boolean" },
          seller_delivery_of_documents_days: { type: "integer", minimum: 0 },
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
          "close_of_escrow", "initial_deposit", "contingencies", "cop_contingency",
          "seller_delivery_of_documents_days", "home_warranty", "final_acceptance_date",
          "counters", "buyers_broker", "sellers_broker"
        ]
      },
      confidence: {
        type: "object",
        properties: {
          overall_confidence: { type: "integer", minimum: 0, maximum: 100 },
          purchase_price: { type: "integer", minimum: 0, maximum: 100 },
          property_address: { type: "integer", minimum: 0, maximum: 100 },
          buyer_names: { type: "integer", minimum: 0, maximum: 100 },
          close_of_escrow: { type: "integer", minimum: 0, maximum: 100 },
          final_acceptance_date: { type: "integer", minimum: 0, maximum: 100 },
          contingencies: { type: "integer", minimum: 0, maximum: 100 },
          home_warranty: { type: "integer", minimum: 0, maximum: 100 },
          brokerage_info: { type: "integer", minimum: 0, maximum: 100 },
          loan_type: { type: "integer", minimum: 0, maximum: 100 }
        },
        required: [
          "overall_confidence", "purchase_price", "property_address", "buyer_names",
          "close_of_escrow", "final_acceptance_date", "contingencies", "home_warranty",
          "brokerage_info", "loan_type"
        ]
      },
      handwriting_detected: { type: "boolean" }
    },
    required: ["extracted", "confidence", "handwriting_detected"]
  };

  const EXTRACTION_PROMPT = `You will be extracting structured information from a Real Estate PDF document (typically a purchase contract) and outputting it as JSON that matches a specific schema. This task requires careful attention to detail, date calculations, and proper handling of amendments/counters that may override original contract terms.

Here is the JSON schema that your output must match:

<schema>
${JSON.stringify(EXTRACTION_SCHEMA, null, 2)}
</schema>

Your task is to extract ALL fields specified in the schema with particular focus on:
- Buyer and seller names
- Property address
- Purchase price
- Final acceptance date (also called effective date)
- Close of escrow date
- Initial deposit amount AND due date
- Seller delivery of documents days (as a number)
- Contingency periods (loan, appraisal, investigation)
- Broker contact information

Follow these extraction rules:

**Override Logic for Counters and Addenda:**
- Counters and addenda ONLY override contract terms if they explicitly mention those specific terms
- If a counter or addendum does not mention a particular field, use the value from the original contract
- When merging information from multiple pages, apply this override logic carefully

**Date Calculation and Formatting:**
- When dates are given as relative terms (e.g., "30 days after acceptance", "within 3 business days"), calculate the actual calendar date
- For "X days after acceptance", add X calendar days to the final acceptance date
- For "within X business days", add X business days (typically X+1 or X+2 calendar days to account for weekends)
- Return all dates in MM/DD/YYYY format whenever possible
- For the initial_deposit.due field: strongly prefer calculating the actual MM/DD/YYYY date over leaving it as a relative phrase
- For close_of_escrow: calculate the actual date if given relatively

**Field-Specific Instructions:**
- seller_delivery_of_documents_days: Extract only the NUMBER (e.g., 7, not "7 days" or "seven days")
- Prices: Include the dollar sign and format with commas (e.g., $500,000)
- Handle handwritten annotations and signatures by interpreting them in context
- Normalize all formats for consistency

**Processing Approach:**
Before providing your final JSON output, use the scratchpad to:
1. Identify all relevant sections (original contract, counters, addenda)
2. Extract values from each section
3. Apply override logic to determine final values
4. Calculate any relative dates to absolute dates
5. Verify all required schema fields are populated

<scratchpad>
Use this space to:
- Note which pages contain which information
- Track which fields are mentioned in counters/addenda vs original contract
- Show your date calculations step-by-step
- Reason through any ambiguities or conflicts
- Map extracted information to schema fields
</scratchpad>

Now provide your final output as valid JSON matching the schema. Your output must:
- Be valid, parseable JSON
- Match the exact structure of the provided schema
- Include all fields from the schema
- Use null for any fields that cannot be found in the document
- Follow all formatting requirements specified above

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

// ── Date calculation helper (unchanged) ─────────────────────────────────────
function calculateDateFromRelative(dateStr: string | null, effectiveDate: string | null): string | null {
  if (!dateStr || !effectiveDate) return dateStr;

  const daysMatch = dateStr.match(/(\d+)\s*days?\s*after/i);
  if (!daysMatch) return dateStr;

  const daysToAdd = parseInt(daysMatch[1], 10);
  if (isNaN(daysToAdd)) return dateStr;

  try {
    const baseDate = new Date(effectiveDate);
    if (isNaN(baseDate.getTime())) return dateStr;

    baseDate.setDate(baseDate.getDate() + daysToAdd);
    const year = baseDate.getFullYear();
    const month = String(baseDate.getMonth() + 1).padStart(2, '0');
    const day = String(baseDate.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  } catch (e) {
    console.error(`[claude-transform] Failed to calculate date from "${dateStr}":`, e);
    return dateStr;
  }
}

// ── Transform to universal format (unchanged) ───────────────────────────────
function transformToUniversal(data: any): any {
  const e = data.extracted;

  const effectiveDate = normalizeDateString(e.final_acceptance_date) || e.final_acceptance_date;

  const purchasePrice = coerceNumber(e.purchase_price);
  const earnestMoneyAmount = e.initial_deposit?.amount ? coerceNumber(e.initial_deposit.amount) : null;
  const sellerCreditAmount = coerceNumber(e.seller_credit_to_buyer);

  let closeOfEscrowDate = e.close_of_escrow;
  closeOfEscrowDate = calculateDateFromRelative(closeOfEscrowDate, effectiveDate);
  closeOfEscrowDate = normalizeDateString(closeOfEscrowDate) || closeOfEscrowDate;

  let sellerDeliveryDate: string | null = null;
  if (e.seller_delivery_of_documents_days && typeof e.seller_delivery_of_documents_days === 'number' && effectiveDate) {
    try {
      const baseDate = new Date(effectiveDate);
      if (!isNaN(baseDate.getTime())) {
        baseDate.setDate(baseDate.getDate() + e.seller_delivery_of_documents_days);
        const year = baseDate.getFullYear();
        const month = String(baseDate.getMonth() + 1).padStart(2, '0');
        const day = String(baseDate.getDate()).padStart(2, '0');
        sellerDeliveryDate = `${year}-${month}-${day}`;
      }
    } catch (error) {
      console.error(`[claude-transform] Failed to calculate seller delivery date:`, error);
    }
  }

  let initialDepositDueDate: string | null = null;
  if (e.initial_deposit?.due && effectiveDate) {
    const normalizedDate = normalizeDateString(e.initial_deposit.due);
    if (normalizedDate) {
      initialDepositDueDate = normalizedDate;
    } else {
      const businessDaysMatch = e.initial_deposit.due.match(/(\d+)\s*business\s*days?\s*after/i);
      const regularDaysMatch = e.initial_deposit.due.match(/(\d+)\s*days?\s*after/i);

      let daysToAdd = 0;
      if (businessDaysMatch) {
        daysToAdd = Math.ceil(parseInt(businessDaysMatch[1], 10) * 1.4);
      } else if (regularDaysMatch) {
        daysToAdd = parseInt(regularDaysMatch[1], 10);
      }

      if (daysToAdd > 0) {
        try {
          const baseDate = new Date(effectiveDate);
          if (!isNaN(baseDate.getTime())) {
            baseDate.setDate(baseDate.getDate() + daysToAdd);
            const year = baseDate.getFullYear();
            const month = String(baseDate.getMonth() + 1).padStart(2, '0');
            const day = String(baseDate.getDate()).padStart(2, '0');
            initialDepositDueDate = `${year}-${month}-${day}`;
          }
        } catch (error) {
          console.error(`[claude-transform] Failed to calculate initial deposit due date:`, error);
        }
      } else {
        initialDepositDueDate = e.initial_deposit.due;
      }
    }
  }

  console.log(`[claude-transform] Coerced purchasePrice: "${e.purchase_price}" → ${purchasePrice}`);
  console.log(`[claude-transform] Coerced earnestMoney: "${e.initial_deposit?.amount}" → ${earnestMoneyAmount}`);
  console.log(`[claude-transform] Coerced sellerCredit: "${e.seller_credit_to_buyer}" → ${sellerCreditAmount}`);
  console.log(`[claude-transform] Calculated closeOfEscrow: "${e.close_of_escrow}" → ${closeOfEscrowDate}`);
  console.log(`[claude-transform] Calculated sellerDelivery: ${e.seller_delivery_of_documents_days} days → ${sellerDeliveryDate}`);
  console.log(`[claude-transform] Normalized initialDepositDue: "${e.initial_deposit?.due}" → ${initialDepositDueDate}`);
  console.log(`[claude-transform] Normalized effectiveDate: "${e.final_acceptance_date}" → ${effectiveDate}`);

  return {
    buyerNames: e.buyer_names || [],
    sellerNames: [],
    propertyAddress: coerceString(e.property_address?.full),
    purchasePrice,
    closeOfEscrowDate,
    effectiveDate,
    initialDepositDueDate,
    sellerDeliveryOfDisclosuresDate: sellerDeliveryDate,

    earnestMoneyDeposit: e.initial_deposit ? {
      amount: earnestMoneyAmount,
      holder: null,
    } : null,

    financing: {
      isAllCash: e.all_cash,
      loanType: coerceString(e.loan_type),
      loanAmount: null,
    },

    contingencies: e.contingencies ? {
      inspectionDays: coerceNumber(e.contingencies.investigation_days, 0),
      appraisalDays: coerceNumber(e.contingencies.appraisal_days, 0),
      loanDays: coerceNumber(e.contingencies.loan_days, 0),
      saleOfBuyerProperty: e.cop_contingency || false,
    } : null,

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
