// src/lib/extraction/gemini/extractPdf.ts
// Version: 1.1.0 - 2026-01-08
// NEW: Gemini 3 Flash Preview for full-document extraction
// Handles up to 100 pages in ONE call with built-in reasoning
// Negates need for post-processing, batching, and role detection
// FIXED: Apply type coercion to convert money strings to numbers

import { GoogleGenerativeAI } from '@google/generative-ai';
import { coerceNumber, coerceString } from '@/lib/grok/type-coercion';
import { normalizeDateString } from '@/lib/extraction/extract/universal/helpers/date-utils';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;

if (!GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY is required');
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// JSON Schema for extraction (based on ExtractionSchema from schema.ts)
const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    extracted: {
      type: "object",
      properties: {
        buyer_names: {
          type: "array",
          items: { type: "string" },
          minItems: 1
        },
        property_address: {
          type: "object",
          properties: {
            full: { type: "string" }
          },
          required: ["full"]
        },
        purchase_price: {
          type: "string",
          pattern: "^\\$\\d{1,3}(,\\d{3})*(\\.\\d{2})?$"
        },
        all_cash: { type: "boolean" },
        close_of_escrow: { type: "string" },
        initial_deposit: {
          type: "object",
          properties: {
            amount: { type: "string" },
            due: { type: "string" }
          },
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
            ordered_by: {
              type: ["string", "null"],
              enum: ["Buyer", "Seller", "Both", "Waived", null]
            },
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
            counter_chain: {
              type: "array",
              items: { type: "string" }
            },
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
        "buyer_names",
        "property_address",
        "purchase_price",
        "all_cash",
        "close_of_escrow",
        "initial_deposit",
        "contingencies",
        "cop_contingency",
        "seller_delivery_of_documents_days",
        "home_warranty",
        "final_acceptance_date",
        "counters",
        "buyers_broker",
        "sellers_broker"
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
        "overall_confidence",
        "purchase_price",
        "property_address",
        "buyer_names",
        "close_of_escrow",
        "final_acceptance_date",
        "contingencies",
        "home_warranty",
        "brokerage_info",
        "loan_type"
      ]
    },
    handwriting_detected: { type: "boolean" }
  },
  required: ["extracted", "confidence", "handwriting_detected"]
};

const EXTRACTION_PROMPT = `Extract JSON from this PDF matching this schema. Focus on buyer/seller names, address, price, closing and contingencies. Any counters or addenda override contract terms ONLY if explicitly mentioned. If no mention of specific terms in counters/addenda then the contract wins.

Schema:
${JSON.stringify(EXTRACTION_SCHEMA, null, 2)}

Return ONLY valid JSON matching the schema above. Use your reasoning to:
1. Merge terms from multiple pages (contract, counters, addenda)
2. Apply override logic: counters/addenda only change explicitly mentioned fields
3. Calculate dates accurately (e.g., close of escrow from acceptance date + contingency days)
4. Handle handwritten annotations and signatures
5. Normalize formats (prices with $, dates as MM/DD/YYYY)`;

export async function extractWithGemini(
  pdfUrl: string,
  totalPages: number
): Promise<{
  finalTerms: any;
  needsReview: boolean;
  criticalPages: string[];
  allExtractions: any[];
}> {
  console.log(`[gemini-extract] Starting extraction for ${totalPages}-page document`);
  console.log(`[gemini-extract] PDF URL: ${pdfUrl}`);

  try {
    // Fetch PDF from URL
    console.log(`[gemini-extract] Fetching PDF from URL...`);
    const pdfResponse = await fetch(pdfUrl);
    if (!pdfResponse.ok) {
      throw new Error(`Failed to fetch PDF: ${pdfResponse.status} ${pdfResponse.statusText}`);
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();
    const pdfBase64 = Buffer.from(pdfBuffer).toString('base64');
    console.log(`[gemini-extract] PDF fetched: ${(pdfBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`);

    // Initialize Gemini model
    const model = genAI.getGenerativeModel({
      model: 'gemini-3-flash-preview',
    });

    console.log(`[gemini-extract] Sending to Gemini 3 Flash Preview...`);

    // Create request with PDF and prompt
    const result = await model.generateContent([
      {
        inlineData: {
          data: pdfBase64,
          mimeType: 'application/pdf'
        }
      },
      EXTRACTION_PROMPT
    ]);

    const response = result.response;
    const text = response.text();

    console.log(`[gemini-extract] Received response (${text.length} chars)`);
    console.log(`[gemini-extract] First 500 chars: ${text.substring(0, 500)}`);

    // Parse JSON response
    let extractedData;
    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) || text.match(/```\n?([\s\S]*?)\n?```/);
      const jsonText = jsonMatch ? jsonMatch[1] : text;
      extractedData = JSON.parse(jsonText.trim());
    } catch (parseError: any) {
      console.error(`[gemini-extract] JSON parse error:`, parseError);
      console.error(`[gemini-extract] Raw text:`, text);
      throw new Error(`Failed to parse Gemini response as JSON: ${parseError.message}`);
    }

    console.log(`[gemini-extract] Successfully parsed extraction data`);
    console.log(`[gemini-extract] Overall confidence: ${extractedData.confidence?.overall_confidence}%`);

    // Transform Gemini response to match expected format
    const finalTerms = transformGeminiToUniversal(extractedData);

    // Determine if review is needed (low confidence or missing critical fields)
    const needsReview =
      extractedData.confidence?.overall_confidence < 80 ||
      !extractedData.extracted?.buyer_names?.length ||
      !extractedData.extracted?.property_address?.full ||
      !extractedData.extracted?.purchase_price;

    console.log(`[gemini-extract] Extraction complete - needsReview: ${needsReview}`);

    return {
      finalTerms,
      needsReview,
      criticalPages: ['1-' + totalPages], // Gemini processes all pages at once
      allExtractions: [extractedData], // Single extraction covering all pages
    };
  } catch (error: any) {
    console.error(`[gemini-extract] Error:`, error);
    throw new Error(`Gemini extraction failed: ${error.message}`);
  }
}

// Helper to calculate date from "X days after acceptance" pattern
function calculateDateFromRelative(dateStr: string | null, effectiveDate: string | null): string | null {
  if (!dateStr || !effectiveDate) return dateStr;

  // Check for "X days after acceptance" pattern
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
    console.error(`[gemini-transform] Failed to calculate date from "${dateStr}":`, e);
    return dateStr;
  }
}

// Transform Gemini's schema format to the UniversalExtractionResult format
function transformGeminiToUniversal(geminiData: any): any {
  const e = geminiData.extracted;

  // First normalize the effective date
  const effectiveDate = normalizeDateString(e.final_acceptance_date) || e.final_acceptance_date;

  // Apply type coercion and date normalization
  const purchasePrice = coerceNumber(e.purchase_price);
  const earnestMoneyAmount = e.initial_deposit?.amount ? coerceNumber(e.initial_deposit.amount) : null;
  const sellerCreditAmount = coerceNumber(e.seller_credit_to_buyer);

  // Calculate close of escrow date (handle relative dates)
  let closeOfEscrowDate = e.close_of_escrow;
  closeOfEscrowDate = calculateDateFromRelative(closeOfEscrowDate, effectiveDate);
  closeOfEscrowDate = normalizeDateString(closeOfEscrowDate) || closeOfEscrowDate;

  // Calculate seller delivery of disclosures date from days
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
      console.error(`[gemini-transform] Failed to calculate seller delivery date:`, error);
    }
  }

  // Calculate initial deposit due date
  let initialDepositDueDate: string | null = null;
  if (e.initial_deposit?.due) {
    // First try to extract a number of days from the string (e.g., "3 days", "3", etc.)
    const daysMatch = e.initial_deposit.due.match(/(\d+)/);
    if (daysMatch && effectiveDate) {
      const businessDays = parseInt(daysMatch[1], 10);
      if (!isNaN(businessDays)) {
        try {
          // Use business days calculation (addBusinessDays helper would be ideal, but we'll use a simple approach)
          // For now, we'll use calendar days since we don't have the business days helper here
          // TODO: Import and use addBusinessDays from date-utils.ts for accurate calculation
          const baseDate = new Date(effectiveDate);
          if (!isNaN(baseDate.getTime())) {
            baseDate.setDate(baseDate.getDate() + businessDays);
            const year = baseDate.getFullYear();
            const month = String(baseDate.getMonth() + 1).padStart(2, '0');
            const day = String(baseDate.getDate()).padStart(2, '0');
            initialDepositDueDate = `${year}-${month}-${day}`;
          }
        } catch (error) {
          console.error(`[gemini-transform] Failed to calculate initial deposit due date:`, error);
        }
      }
    }

    // If we couldn't calculate from days, try to normalize as an absolute date
    if (!initialDepositDueDate) {
      initialDepositDueDate = normalizeDateString(e.initial_deposit.due) || null;
    }
  }

  console.log(`[gemini-transform] Coerced purchasePrice: "${e.purchase_price}" → ${purchasePrice}`);
  console.log(`[gemini-transform] Coerced earnestMoney: "${e.initial_deposit?.amount}" → ${earnestMoneyAmount}`);
  console.log(`[gemini-transform] Coerced sellerCredit: "${e.seller_credit_to_buyer}" → ${sellerCreditAmount}`);
  console.log(`[gemini-transform] Calculated closeOfEscrow: "${e.close_of_escrow}" → ${closeOfEscrowDate}`);
  console.log(`[gemini-transform] Calculated sellerDelivery: ${e.seller_delivery_of_documents_days} days → ${sellerDeliveryDate}`);
  console.log(`[gemini-transform] Normalized initialDepositDue: "${e.initial_deposit?.due}" → ${initialDepositDueDate}`);
  console.log(`[gemini-transform] Normalized effectiveDate: "${e.final_acceptance_date}" → ${effectiveDate}`);

  return {
    // Core fields
    buyerNames: e.buyer_names || [],
    sellerNames: [], // Not in schema but needed for universal format
    propertyAddress: coerceString(e.property_address?.full),
    purchasePrice,
    closeOfEscrowDate,
    effectiveDate,
    initialDepositDueDate,
    sellerDeliveryOfDisclosuresDate: sellerDeliveryDate,

    // Earnest money
    earnestMoneyDeposit: e.initial_deposit ? {
      amount: earnestMoneyAmount,
      holder: null, // Not in schema
    } : null,

    // Financing
    financing: {
      isAllCash: e.all_cash,
      loanType: coerceString(e.loan_type),
      loanAmount: null, // Not in schema
    },

    // Contingencies
    contingencies: e.contingencies ? {
      inspectionDays: coerceNumber(e.contingencies.investigation_days, 0),
      appraisalDays: coerceNumber(e.contingencies.appraisal_days, 0),
      loanDays: coerceNumber(e.contingencies.loan_days, 0),
      saleOfBuyerProperty: e.cop_contingency || false,
    } : null,

    // Closing costs
    closingCosts: {
      buyerPays: [],
      sellerPays: [],
      sellerCreditAmount,
    },

    // Brokers
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

    // Additional fields
    personalPropertyIncluded: null,
    escrowHolder: null,

    // Metadata
    confidence: geminiData.confidence,
    handwritingDetected: geminiData.handwriting_detected,
    counters: e.counters,
  };
}
