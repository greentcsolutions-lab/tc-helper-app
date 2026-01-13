// src/lib/extraction/claude/extractPdf.ts
// Version: 1.0.0 - 2026-01-13
// Initial implementation mirroring Gemini for Claude Sonnet
// Supports direct PDF base64 upload via Anthropic Messages API

import { coerceNumber, coerceString } from '@/lib/grok/type-coercion';
import { normalizeDateString } from '@/lib/extraction/extract/universal/helpers/date-utils';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;
if (!ANTHROPIC_API_KEY) {
  throw new Error('ANTHROPIC_API_KEY is required');
}

// ── JSON Schema (unchanged from Gemini) ─────────────────────────────────────────────────
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

// ── Extraction Prompt (unchanged) ───────────────────────────────────────────
const EXTRACTION_PROMPT = `Extract JSON from this PDF matching this schema. Focus on ALL fields in the schema, especially:
- Buyer/seller names, property address, purchase price
- Final acceptance date (effective date)
- Close of escrow date
- Initial deposit amount AND due date (initial_deposit.due) - CALCULATE the actual date if given as "X days after acceptance"
- Seller delivery of documents days (seller_delivery_of_documents_days) - extract as NUMBER of days
- Contingency periods (loan, appraisal, investigation)
- Broker contact information
Any counters or addenda override contract terms ONLY if explicitly mentioned. If no mention of specific terms in counters/addenda then the contract wins.
Schema:
${JSON.stringify(EXTRACTION_SCHEMA, null, 2)}
Return ONLY valid JSON matching the schema above. Use your reasoning to:
1. Merge terms from multiple pages (contract, counters, addenda)
2. Apply override logic: counters/addenda only change explicitly mentioned fields
3. Calculate dates accurately:
   - If close of escrow says "30 days after acceptance", calculate the actual date
   - If initial deposit says "within 3 business days", calculate the actual date (acceptance + 4-5 days)
   - Return dates in MM/DD/YYYY format when possible
4. Handle handwritten annotations and signatures
5. Normalize formats (prices with $, dates as MM/DD/YYYY)
6. For seller_delivery_of_documents_days: extract just the NUMBER (e.g., 7 not "7 days")
7. For initial_deposit.due: prefer calculating the actual MM/DD/YYYY date over relative phrases`;

export async function extractWithClaude(
  pdfUrl: string,
  totalPages: number,
  modelName: string = 'claude-4-sonnet-20250514'
): Promise<{
  finalTerms: any;
  needsReview: boolean;
  criticalPages: string[];
  allExtractions: any[];
  modelUsed: string;
}> {
  console.log(`[claude-extract] Starting extraction for ${totalPages}-page document using model: ${modelName}`);
  console.log(`[claude-extract] PDF URL: ${pdfUrl}`);

  try {
    // Fetch PDF
    console.log(`[claude-extract] Fetching PDF from URL...`);
    const pdfResponse = await fetch(pdfUrl);
    if (!pdfResponse.ok) {
      throw new Error(`Failed to fetch PDF: ${pdfResponse.status} ${pdfResponse.statusText}`);
    }
    const pdfBuffer = await pdfResponse.arrayBuffer();
    const pdfBase64 = Buffer.from(pdfBuffer).toString('base64');
    console.log(`[claude-extract] PDF fetched: ${(pdfBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`);

    console.log(`[claude-extract] Sending request to ${modelName} at ${new Date().toISOString()}...`);

    const startTime = Date.now();

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        max_tokens: 4096, // Sufficient for JSON output
        temperature: 0.1, // Low for deterministic extraction
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
                text: EXTRACTION_PROMPT,
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
    console.log(`[claude-extract] Response received from ${modelName} after ${durationMs}ms at ${new Date().toISOString()}`);

    const text = result.content[0].text;
    console.log(`[claude-extract] Received response (${text.length} chars)`);
    console.log(`[claude-extract] First 500 chars: ${text.substring(0, 500)}`);

    // Robust JSON parsing (strip markdown if present)
    let extractedData;
    try {
      const jsonMatch = text.match(/```json
      const jsonText = jsonMatch ? jsonMatch[1] : text;
      extractedData = JSON.parse(jsonText.trim());
    } catch (parseError: any) {
      console.error(`[claude-extract] JSON parse error:`, parseError);
      console.error(`[claude-extract] Raw text:`, text);
      throw new Error(`Failed to parse Claude response as JSON: ${parseError.message}`);
    }

    console.log(`[claude-extract] Successfully parsed extraction data`);
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

// ── Transform to universal format (unchanged, renamed for generality) ───────────────────────────────
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
