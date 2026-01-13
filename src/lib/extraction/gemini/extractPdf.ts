// src/lib/extraction/gemini/extractPdf.ts
// Version: 1.2.0 - 2026-01-13
// ADDED: Optional model param for primary/fallback (gemini-3-flash-preview default)
// ADDED: modelUsed in return for logging/tracking
// Gemini 3 Flash Preview for full-document extraction + safe fallback path
import { GoogleGenerativeAI } from '@google/generative-ai';
import { coerceNumber, coerceString } from '@/lib/grok/type-coercion';
import { normalizeDateString } from '@/lib/extraction/extract/universal/helpers/date-utils';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
if (!GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY is required');
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// JSON Schema remains unchanged...
const EXTRACTION_SCHEMA = { /* ... your full schema here, unchanged ... */ };

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

export async function extractWithGemini(
  pdfUrl: string,
  totalPages: number,
  modelName: string = 'gemini-3-flash-preview'  // <-- NEW: optional, defaults to primary
): Promise<{
  finalTerms: any;
  needsReview: boolean;
  criticalPages: string[];
  allExtractions: any[];
  modelUsed: string;  // <-- NEW: expose which model actually ran
}> {
  console.log(`[gemini-extract] Starting extraction for ${totalPages}-page document using model: ${modelName}`);
  console.log(`[gemini-extract] PDF URL: ${pdfUrl}`);

  try {
    // Fetch PDF from URL (unchanged)
    console.log(`[gemini-extract] Fetching PDF from URL...`);
    const pdfResponse = await fetch(pdfUrl);
    if (!pdfResponse.ok) {
      throw new Error(`Failed to fetch PDF: ${pdfResponse.status} ${pdfResponse.statusText}`);
    }
    const pdfBuffer = await pdfResponse.arrayBuffer();
    const pdfBase64 = Buffer.from(pdfBuffer).toString('base64');
    console.log(`[gemini-extract] PDF fetched: ${(pdfBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`);

    // Initialize model with the requested name
    const model = genAI.getGenerativeModel({
      model: modelName,
      // Optional: Tune for fallback model (Lite) – lower thinking/resolution for speed & cost
      generationConfig: modelName.includes('lite')
        ? {
            temperature: 0.1,           // more deterministic for extraction
            topP: 0.95,
            // If SDK supports thinking_level (preview feature), force minimal on Lite
            // thinking_level: 'minimal',  // uncomment if available in your SDK version
          }
        : undefined,
    });

    console.log(`[gemini-extract] Sending to ${modelName}...`);

    // Create request with PDF and prompt (unchanged)
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

    // Parse JSON response (unchanged, robust handling)
    let extractedData;
    try {
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

    // Transform (unchanged)
    const finalTerms = transformGeminiToUniversal(extractedData);

    // Needs review logic (unchanged)
    const needsReview =
      extractedData.confidence?.overall_confidence < 80 ||
      !extractedData.extracted?.buyer_names?.length ||
      !extractedData.extracted?.property_address?.full ||
      !extractedData.extracted?.purchase_price;

    console.log(`[gemini-extract] Extraction complete - needsReview: ${needsReview}`);

    return {
      finalTerms,
      needsReview,
      criticalPages: ['1-' + totalPages],
      allExtractions: [extractedData],
      modelUsed: modelName,  // <-- NEW: critical for route-level logging
    };
  } catch (error: any) {
    console.error(`[gemini-extract] Error with ${modelName}:`, error);
    throw new Error(`Gemini extraction failed (${modelName}): ${error.message}`);
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

  // Calculate initial deposit due date (handle both specific dates and relative phrases)
  let initialDepositDueDate: string | null = null;
  if (e.initial_deposit?.due && effectiveDate) {
    // First try to normalize if it's already a date
    const normalizedDate = normalizeDateString(e.initial_deposit.due);
    if (normalizedDate) {
      initialDepositDueDate = normalizedDate;
    } else {
      // Try to extract business days or regular days from phrases like:
      // "Within 3 business days after Acceptance"
      // "3 days after acceptance"
      const businessDaysMatch = e.initial_deposit.due.match(/(\d+)\s*business\s*days?\s*after/i);
      const regularDaysMatch = e.initial_deposit.due.match(/(\d+)\s*days?\s*after/i);

      let daysToAdd = 0;
      if (businessDaysMatch) {
        // For business days, approximate as 1.4x regular days (accounts for weekends)
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
          console.error(`[gemini-transform] Failed to calculate initial deposit due date:`, error);
        }
      } else {
        // If we can't parse it, keep the original string (better than null)
        initialDepositDueDate = e.initial_deposit.due;
      }
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
