// src/lib/extraction/mistral/extractPdf.ts
// Version: 2.2.0 - 2026-01-08
// UPDATED: Fixed response parsing - Mistral returns document_annotation as single aggregated object per chunk
// Uses document_url + pages array (≤8 pages per call, 0-indexed)
// Each chunk returns ONE aggregated extraction covering all pages in that chunk
// Parallel execution with Promise.all
// Filters by data quality (chunk-level aggregated extractions)
// Last-write-wins merge across chunks

import { mistralExtractorSchema } from './schema';

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/ocr';
const API_KEY = process.env.MISTRAL_API_KEY!;

if (!API_KEY) {
  throw new Error('MISTRAL_API_KEY is required');
}

interface ExtractionChunk {
  pageNumbers: number[]; // 1-based for your logic
  extractions: any[];
}

// Helper: Check if an extraction has substantive data (same as before)
function hasSubstantiveData(extraction: any): boolean {
  if (!extraction) return false;

  const hasPrice = extraction.purchasePrice || extraction.listPrice;
  const hasDates = extraction.closingDate || extraction.acceptanceDate || extraction.effectiveDate;
  const hasParties = extraction.buyerNames?.length > 0 || extraction.sellerNames?.length > 0;
  const hasProperty = extraction.propertyAddress;
  const hasTerms = extraction.earnestMoneyDeposit || extraction.contingencies?.length > 0;
  const hasSignatures = extraction.signatures?.length > 0;

  const substantiveCount = [hasPrice, hasDates, hasParties, hasProperty, hasTerms, hasSignatures]
    .filter(Boolean).length;

  return substantiveCount >= 2;
}

export async function extractAllPages(
  pdfUrl: string,
  totalPages: number
): Promise<{
  finalTerms: any;
  needsReview: boolean;
  criticalPages: string[]; // Page ranges for chunks with substantive data (e.g., "1-8", "9-16")
  allExtractions: any[];
}> {
  console.log(`[extractPdf] Extracting all ${totalPages} pages in batches of ≤8 (parallel, via pages param)`);

  // Generate 1-based page numbers
  const allPageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);

  // Split into chunks of 8 pages max
  const chunks: number[][] = [];
  for (let i = 0; i < allPageNumbers.length; i += 8) {
    chunks.push(allPageNumbers.slice(i, i + 8));
  }

  console.log(`[extractPdf] ${totalPages} pages → ${chunks.length} chunk(s) of ≤8 pages`);

  // Parallel execution – each chunk sends document_url + specific pages array (0-indexed for Mistral)
  const chunkPromises = chunks.map(async (pageNumbers, chunkIndex) => {
    console.log(
      `[extractPdf] Starting chunk ${chunkIndex + 1}/${chunks.length} – pages ${pageNumbers.join(', ')}`
    );

    // Convert to 0-indexed for Mistral API
    const zeroBasedPages = pageNumbers.map(p => p - 1);

    const payload = {
      model: 'mistral-ocr-latest',
      document: {
        type: 'document_url',
        document_url: pdfUrl,
      },
      pages: zeroBasedPages, // Explicit page selection – respects 8-page annotation limit
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

    // NEW: Single aggregated extraction per chunk
    // Mistral returns document_annotation as one object for the entire batch,
    // not as an array per page
    if (!annotationObj || typeof annotationObj !== 'object') {
      throw new Error('Invalid extraction response: missing or invalid document_annotation');
    }

    // Wrap as single-item array for compatibility with downstream code
    return {
      pageNumbers,
      extractions: [annotationObj],
    };
  });

  const chunkResults: ExtractionChunk[] = await Promise.all(chunkPromises);

  console.log(`[extractPdf] All ${chunks.length} chunks completed in parallel`);

  // Flatten aggregated chunk extractions
  // Each chunk now returns ONE aggregated extraction covering multiple pages
  const allPageExtractions = chunkResults.flatMap((chunk) =>
    chunk.extractions.map((ext: any) => ({
      ...ext,
      sourcePage: chunk.pageNumbers.join('-'), // Page range for this chunk
    }))
  );

  console.log(`[extractPdf] Total ${allPageExtractions.length} chunk extraction(s) received`);

  // Filter by data quality (chunk-level aggregated extractions)
  const substantiveExtractions = allPageExtractions.filter((ext) => {
    const isSubstantive = hasSubstantiveData(ext);
    if (!isSubstantive) {
      console.log(`[extractPdf] Filtering out chunk pages ${ext.sourcePage} - no substantive data`);
    }
    return isSubstantive;
  });

  const criticalPages = substantiveExtractions.map(ext => ext.sourcePage);

  console.log(
    `[extractPdf] Filtered ${allPageExtractions.length} → ${substantiveExtractions.length} substantive chunk(s): [${criticalPages.join(', ')}]`
  );

  // Simple merge (last-write-wins)
  const finalTerms: any = {};
  for (const extraction of substantiveExtractions) {
    for (const [key, value] of Object.entries(extraction)) {
      if (key === 'sourcePage') continue;
      if (value && value !== null && value !== undefined) {
        if (Array.isArray(value) && value.length === 0) continue;
        finalTerms[key] = value;
      }
    }
  }

  return {
    finalTerms,
    needsReview: substantiveExtractions.length === 0,
    criticalPages,
    allExtractions: substantiveExtractions,
  };
}