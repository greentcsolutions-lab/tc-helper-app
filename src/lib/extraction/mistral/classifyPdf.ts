// src/lib/extraction/mistral/classifyPdf.ts
// Version: 1.2.0 - 2026-01-07
// SWITCHED: Basic OCR mode (no annotations) to handle full packets (>8 pages)
// Returns per-page markdown array + pageCount

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/ocr';
const API_KEY = process.env.MISTRAL_API_KEY;

if (!API_KEY) {
  throw new Error('MISTRAL_API_KEY environment variable is required');
}

export interface OcrPage {
  markdown: string;
  // Other fields like dimensions/image_base64 may exist but we ignore them
}

export interface BasicOcrResponse {
  pageCount: number;
  pages: OcrPage[];
}

export async function callMistralClassify(pdfUrl: string): Promise<BasicOcrResponse> {
  const payload = {
    model: 'mistral-ocr-latest',
    document: {
      type: 'document_url',
      document_url: pdfUrl,
    },
    // No document_annotation_format → basic OCR mode (per-page markdown)
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
        lastError = new Error(`Mistral API error ${response.status}: ${errorText}`);
        if (response.status >= 500 || response.status === 429) {
          if (attempt < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
            continue;
          }
        }
        throw lastError;
      }

      const data = await response.json();

      // Basic OCR response validation
      if (!data.pages || !Array.isArray(data.pages)) {
        throw new Error('Invalid Mistral OCR response: missing or invalid pages array');
      }

      const pageCount = data.pageCount ?? data.pages.length;

      if (data.pages.length !== pageCount) {
        console.warn(
          `[mistralClassify] pageCount mismatch: declared ${pageCount}, actual ${data.pages.length}`
        );
      }

      // Ensure each page has markdown
      const pages = data.pages.map((p: any, idx: number) => ({
        markdown: p.markdown ?? '',
      }));

      return {
        pageCount,
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

  throw lastError instanceof Error ? lastError : new Error('Unknown error calling Mistral OCR');
}