// src/lib/extraction/mistral/mistralClient.ts
// Version: 1.0.0 - 2026-01-05
// Raw client for Mistral /v1/ocr endpoint
// Handles single chunk request + retry logic
// Parallel calls are orchestrated in index.ts

import { mistralJsonSchema } from './schema';

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/ocr';
const API_KEY = process.env.MISTRAL_API_KEY;

if (!API_KEY) {
  throw new Error('MISTRAL_API_KEY environment variable is required');
}

export interface MistralChunkResponse {
  extractions: Array<{
    // Matches PerPageExtraction from types/extraction.ts + confidence.sources
    buyerNames?: string[] | null;
    sellerNames?: string[] | null;
    propertyAddress?: string | null;
    purchasePrice?: number | null;
    earnestMoneyDeposit?: { amount: number | null; holder: string | null } | null;
    closingDate?: string | null;
    financing?: {
      isAllCash: boolean | null;
      loanType: string | null;
      loanAmount: number | null;
    } | null;
    contingencies?: {
      inspectionDays: number | string | null;
      appraisalDays: number | string | null;
      loanDays: number | string | null;
      saleOfBuyerProperty: boolean;
    } | null;
    closingCosts?: {
      buyerPays: string[] | null;
      sellerPays: string[] | null;
      sellerCreditAmount: number | null;
    } | null;
    brokers?: {
      listingBrokerage: string | null;
      listingAgent: string | null;
      sellingBrokerage: string | null;
      sellingAgent: string | null;
    } | null;
    personalPropertyIncluded?: string[] | null;
    buyerSignatureDates?: string[] | null;
    sellerSignatureDates?: string[] | null;
    escrowHolder?: string | null;
    confidence: {
      overall: number;
      fieldScores?: Record<string, number>;
      sources: Record<string, string>; // REQUIRED by schema
    };
  }>;
}

/**
 * Calls Mistral OCR with structured annotation for one chunk
 * Retries up to 3 times on transient errors (5xx, timeout, rate limit)
 */
export async function callMistralChunk(
  pdfBase64: string,
  expectedPageCount: number
): Promise<MistralChunkResponse> {
  const dataUri = `data:application/pdf;base64,${pdfBase64}`;

  const payload = {
    model: 'mistral-ocr-latest',
    document: {
        type: 'document_url',
         document_url: dataUri,  // plain string
        },
    document_annotation_format: {
      type: 'json_schema',
      json_schema: mistralJsonSchema,
    },
    // Optional enhancements – can tune later
    // include_image_base64: false,
    // table_format: 'html',
  };

  let lastError: any;
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(MISTRAL_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        if (response.status >= 500 || response.status === 429) {
          // Transient: retry
          lastError = new Error(`Mistral API error ${response.status}: ${errorText}`);
          if (attempt < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, 1000 * attempt)); // exponential backoff lite
            continue;
          }
        }
        throw new Error(`Mistral API error ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      // Basic validation: must have extractions array matching page count
      if (!data.document_annotation?.extractions || !Array.isArray(data.document_annotation.extractions)) {
        throw new Error('Invalid Mistral response: missing or invalid document_annotation.extractions');
      }

      if (data.document_annotation.extractions.length !== expectedPageCount) {
        console.warn(
          `[mistralClient] Page count mismatch: expected ${expectedPageCount}, got ${data.document_annotation.extractions.length}`
        );
      }

      return { extractions: data.document_annotation.extractions };
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        continue;
      }
    }
  }

  throw lastError || new Error('Unknown error calling Mistral OCR');
}