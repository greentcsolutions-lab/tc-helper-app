// src/lib/extraction/mistral/extractPdf.ts
// Version: 1.1.0 - 2026-01-07
// FIXED: Now extracts subset PDFs per chunk using pdf-lib
// Uploads to Vercel Blob for temp URL
// Sends only chunk PDFs to Mistral (bypasses 8-page limit check)
// Parallel execution with Promise.all

import { PDFDocument } from 'pdf-lib';
import { put } from '@vercel/blob';
import { mistralExtractorSchema } from './schema';
import { mergePageExtractions } from '@/lib/extraction/extract/universal/post-processor';

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/ocr';
const API_KEY = process.env.MISTRAL_API_KEY!;

if (!API_KEY) {
  throw new Error('MISTRAL_API_KEY is required');
}

// Exact shape for mergePageExtractions
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

async function fetchPdfBuffer(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch PDF: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

async function extractPdfSubset(buffer: Uint8Array, pageNumbers: number[]): Promise<string> {
  const fullPdf = await PDFDocument.load(buffer);
  const subsetPdf = await PDFDocument.create();

  // Copy specific pages (1-based → 0-based index)
  const copiedPages = await subsetPdf.copyPages(fullPdf, pageNumbers.map(p => p - 1));
  copiedPages.forEach(page => subsetPdf.addPage(page));

  const subsetBuffer = await subsetPdf.save();
  // Convert Uint8Array to Node Buffer for @vercel/blob put
  const subsetBufferNode = Buffer.from(subsetBuffer);

  // Upload to Vercel Blob (temp public URL)
  const { url } = await put(`temp-chunk-${Date.now()}.pdf`, subsetBufferNode, {
    access: 'public',
    addRandomSuffix: true, // unique name
  });

  return url;
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

  // Normalize pageLabels to string keys
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

  // Fetch full PDF buffer once (shared across chunks)
  const fullPdfBuffer = await fetchPdfBuffer(pdfUrl);

  // Parallel execution
  const chunkPromises = chunks.map(async (pageNumbers, chunkIndex) => {
    console.log(
      `[extractPdf] Starting chunk ${chunkIndex + 1}/${chunks.length} – pages ${pageNumbers.join(', ')}`
    );

    // Extract subset PDF for this chunk
    const subsetUrl = await extractPdfSubset(fullPdfBuffer, pageNumbers);

    console.log(`[extractPdf] Chunk ${chunkIndex + 1} subset PDF uploaded: ${subsetUrl}`);

    const payload = {
      model: 'mistral-ocr-latest',
      document: {
        type: 'document_url',
        document_url: subsetUrl,
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

  const mergeResult = await mergePageExtractions(allPageExtractions, normalizedMetadata);

  return mergeResult;
}