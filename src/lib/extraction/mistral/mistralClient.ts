// src/lib/extraction/mistral/mistralClient.ts
// Version: 1.0.1 - 2026-01-05
// ADDED: Detailed logging + fixed TS error in catch block

import { mistralJsonSchema } from './schema';

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/ocr';
const API_KEY = process.env.MISTRAL_API_KEY;

if (!API_KEY) {
  throw new Error('MISTRAL_API_KEY environment variable is required');
}

export interface MistralChunkResponse {
  extractions: Array<{
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
      sources: Record<string, string>;
    };
  }>;
}

export async function callMistralChunk(
  pdfUrl: string,
  expectedPageCount: number
): Promise<MistralChunkResponse> {

  const payload = {
    model: 'mistral-ocr-latest',
    document: {
      type: 'document_url',
      document_url: pdfUrl,
    },
    document_annotation_format: {
      type: 'json_schema',
      json_schema: mistralJsonSchema,
    },
  };

  let lastError: unknown;
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
          lastError = new Error(`Mistral API error ${response.status}: ${errorText}`);
          if (attempt < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
            continue;
          }
        }
        throw new Error(`Mistral API error ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      // 🔍 DEBUG LOGGING
      console.log('[mistralClient] === RAW MISTRAL RESPONSE ===');
      console.log('[mistralClient] Full response keys:', Object.keys(data));
      console.log('[mistralClient] Has document_annotation:', 'document_annotation' in data);
      console.log('[mistralClient] document_annotation type:', typeof data.document_annotation);
      console.log('[mistralClient] document_annotation value:', JSON.stringify(data.document_annotation, null, 2));

      if (data.pages) {
        console.log(`[mistralClient] OCR pages received: ${data.pages.length}`);
      }

      // Existing validation
      if (!data.document_annotation?.extractions || !Array.isArray(data.document_annotation.extractions)) {
        throw new Error('Invalid Mistral response: missing or invalid document_annotation.extractions');
      }

      if (data.document_annotation.extractions.length !== expectedPageCount) {
        console.warn(
          `[mistralClient] Page count mismatch: expected ${expectedPageCount}, got ${data.document_annotation.extractions.length}`
        );
      }

      return { extractions: data.document_annotation.extractions };
    } catch (err: unknown) {
      // ← Explicitly typed as unknown
      let message = 'Unknown error';
      if (err instanceof Error) {
        message = err.message;
      } else if (typeof err === 'string') {
        message = err;
      }

      lastError = new Error(message);

      console.log(`[mistralClient] Retry ${attempt + 1}/${maxRetries} after error: ${message}`);

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        continue;
      }
    }
  }

  // Throw the last captured error safely
  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new Error('Unknown error calling Mistral OCR');
}