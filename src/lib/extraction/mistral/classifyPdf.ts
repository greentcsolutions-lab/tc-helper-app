// src/lib/extraction/mistral/classifyPdf.ts
// Version: 1.1.0 - 2026-01-07
// Updated for new classifier schema that includes root-level pageCount
// Removed expectedPageCount parameter – pageCount now comes directly from Mistral
// Reuses the same robust fetching/parsing logic

import { mistralClassifierSchema } from './schema';

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/ocr';
const API_KEY = process.env.MISTRAL_API_KEY;

if (!API_KEY) {
  throw new Error('MISTRAL_API_KEY environment variable is required');
}

export interface MistralClassifyResponse {
  state: string | null;
  pageCount: number;
  pages: Array<{
    pdfPage: number;
    state?: string | null;
    formCode: string;
    formRevision?: string | null;
    formPage?: number | null;
    totalPagesInForm?: number | null;
    role: string;
    titleSnippet?: string;
    confidence: number;
    contentCategory: string;
    hasFilledFields: boolean;
    footerText?: string;
  } | null>;
}

export async function callMistralClassify(
  pdfUrl: string
): Promise<MistralClassifyResponse> {
  const payload = {
    model: 'mistral-ocr-latest',
    document: {
      type: 'document_url',
      document_url: pdfUrl,
    },
    document_annotation_format: {
      type: 'json_schema',
      json_schema: mistralClassifierSchema,
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

      // Debug logging
      console.log('[mistralClassify] === RAW RESPONSE KEYS ===');
      console.log('[mistralClassify] Keys:', Object.keys(data));
      console.log('[mistralClassify] Has document_annotation:', 'document_annotation' in data);

      let annotationObj: any;

      if (typeof data.document_annotation === 'string') {
        try {
          annotationObj = JSON.parse(data.document_annotation);
        } catch (parseErr) {
          throw new Error('Invalid Mistral response: document_annotation is not valid JSON string');
        }
      } else {
        annotationObj = data.document_annotation;
      }

      if (!annotationObj || !Array.isArray(annotationObj.pages)) {
        throw new Error('Invalid Mistral response: missing or invalid pages array in document_annotation');
      }

      // Validate pageCount matches pages array length
      if (typeof annotationObj.pageCount !== 'number' || annotationObj.pageCount !== annotationObj.pages.length) {
        console.warn(
          `[mistralClassify] pageCount mismatch: declared ${annotationObj.pageCount}, actual pages ${annotationObj.pages.length}`
        );
      }

      // Normalise page numbers if missing (fallback to index + 1)
      const pages = annotationObj.pages.map((p: any, idx: number) => {
        if (p === null) return null;
        return {
          pdfPage: p.pdfPage ?? idx + 1,
          ...p,
        };
      });

      return {
        state: annotationObj.state ?? null,
        pageCount: annotationObj.pageCount,
        pages,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      lastError = new Error(message);
      console.log(`[mistralClassify] Retry ${attempt}/${maxRetries} after error: ${message}`);

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        continue;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Unknown error calling Mistral classify');
}