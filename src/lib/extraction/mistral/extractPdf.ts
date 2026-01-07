// src/lib/extraction/mistral/extractPdf.ts
// Version: 1.0.2 - 2026-01-07
// FIXED: TypeScript error – pageLabels now matches post-processor expectation
// Parallel extraction with Promise.all

import { mistralExtractorSchema } from './schema';
import { mergePageExtractions } from '@/lib/extraction/extract/universal/post-processor';

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/ocr';
const API_KEY = process.env.MISTRAL_API_KEY!;

if (!API_KEY) {
  throw new Error('MISTRAL_API_KEY is required');
}

// Exact shape expected by mergePageExtractions (second argument)
// pageLabels must be Record<string, string> and required (not optional)
// We convert number keys to string and provide empty object fallback
interface ExpectedClassificationMetadata {
  criticalPageNumbers: number[];
  pageLabels: Record<string, string>;
  packageMetadata: any;
  state?: string | null;
}

interface ExtractionChunk {
  pageNumbers: number[];
  extractions: any[];
}

export async function extractFromCriticalPages(
  pdfUrl: string,
  classificationMetadata: {
    criticalPageNumbers: number[];
    pageLabels?: Record<number, string>;
    packageMetadata?: any;
    state?: string | null;
  }
): Promise<{
  finalTerms: any;
  needsReview: boolean;
  provenance: any;
  pageExtractions: any;
}> {
  const { criticalPageNumbers, pageLabels = {}, packageMetadata = {}, state = null } = classificationMetadata;

  if (criticalPageNumbers.length === 0) {
    return {
      finalTerms: {},
      needsReview: false,
      provenance: {},
      pageExtractions: [],
    };
  }

  // Convert pageLabels number keys → string keys (post-processor expects string)
  const normalizedPageLabels: Record<string, string> = {};
  Object.entries(pageLabels).forEach(([pageNum, label]) => {
    normalizedPageLabels[String(pageNum)] = label;
  });

  const normalizedMetadata: ExpectedClassificationMetadata = {
    criticalPageNumbers,
    pageLabels: normalizedPageLabels,
    packageMetadata,
    state,
  };

  // Split into chunks of 8 pages max
  const chunks: number[][] = [];
  for (let i = 0; i < criticalPageNumbers.length; i += 8) {
    chunks.push(criticalPageNumbers.slice(i, i + 8));
  }

  console.log(
    `[extractPdf] ${criticalPageNumbers.length} critical pages → ${chunks.length} chunk(s) of ≤8 pages (parallel)`
  );

  // Parallel execution of all chunks
  const chunkPromises = chunks.map(async (pageNumbers, chunkIndex) => {
    console.log(
      `[extractPdf] Starting chunk ${chunkIndex + 1}/${chunks.length} – pages ${pageNumbers.join(', ')}`
    );

    const payload = {
      model: 'mistral-ocr-latest',
      document: {
        type: 'document_url',
        document_url: pdfUrl,
      },
      document_annotation_format: {
        type: 'json_schema',
        json_schema: {
          name: 'real_estate_transaction_extractor',
          strict: true,
          schema: mistralExtractorSchema,
        },
      },
    };

    const response = await fetch(MISTRAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Mistral extraction failed (chunk ${chunkIndex + 1}) ${response.status}: ${errorText}`
      );
    }

    const data = await response.json();

    let annotationObj: any;
    if (typeof data.document_annotation === 'string') {
      annotationObj = JSON.parse(data.document_annotation);
    } else {
      annotationObj = data.document_annotation;
    }

    if (!annotationObj?.extractions || !Array.isArray(annotationObj.extractions)) {
      throw new Error('Invalid extraction response: missing extractions array');
    }

    return {
      pageNumbers,
      extractions: annotationObj.extractions,
    };
  });

  const chunkResults: ExtractionChunk[] = await Promise.all(chunkPromises);

  console.log(`[extractPdf] All ${chunks.length} chunks completed in parallel`);

  // Flatten and restore original sourcePage
  const allPageExtractions = chunkResults.flatMap((chunk) =>
    chunk.extractions.map((ext: any, idx: number) => ({
      ...ext,
      sourcePage: chunk.pageNumbers[idx],
    }))
  );

  console.log(`[extractPdf] Merged ${allPageExtractions.length} page extractions`);

  // Pass fully normalized metadata to post-processor
  const mergeResult = await mergePageExtractions(allPageExtractions, normalizedMetadata);

  return mergeResult;
}