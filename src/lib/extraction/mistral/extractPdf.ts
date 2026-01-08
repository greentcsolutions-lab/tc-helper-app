// src/lib/extraction/mistral/extractPdf.ts
// Version: 3.0.0 - 2026-01-08
// FIXED: Now uses proper post-processor with role-based allowlist merge
// Counter offers only override explicitly mentioned fields (not last-write-wins)
// Uses document_url + pages array (≤8 pages per call, 0-indexed)
// Each chunk returns ONE aggregated extraction covering all pages in that chunk
// Parallel execution with Promise.all
// Filters by data quality (chunk-level aggregated extractions)
// Proper role detection and selective merge

import { mistralExtractorSchema } from './schema';
import { mergePageExtractions } from '../extract/universal/post-processor';
import type { PerPageExtraction } from '@/types/extraction';

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

// Helper: Detect if extraction contains counter offer indicators
function detectPageRole(extraction: any, chunkIndex: number, mainContractPrice: number | null): 'main_contract' | 'counter_offer' | 'addendum' {
  if (!extraction) return 'main_contract';

  // First chunk is always main contract
  if (chunkIndex === 0) return 'main_contract';

  // Check for counter offer indicators:
  // 1. Price change from main contract
  if (mainContractPrice && extraction.purchasePrice && extraction.purchasePrice !== mainContractPrice) {
    console.log(`[role-detection] Chunk ${chunkIndex + 1}: Price changed ${mainContractPrice} → ${extraction.purchasePrice} → counter_offer`);
    return 'counter_offer';
  }

  // 2. Has signatures but different dates (suggests negotiation rounds)
  const hasBuyerSigs = extraction.buyerSignatureDates?.length > 0;
  const hasSellerSigs = extraction.sellerSignatureDates?.length > 0;
  if (hasBuyerSigs || hasSellerSigs) {
    console.log(`[role-detection] Chunk ${chunkIndex + 1}: Has signatures after main contract → counter_offer`);
    return 'counter_offer';
  }

  // 3. Has closing date changes (common in counters)
  if (extraction.closingDate) {
    console.log(`[role-detection] Chunk ${chunkIndex + 1}: Has closing date → likely counter_offer`);
    return 'counter_offer';
  }

  // 4. Has contingency changes
  if (extraction.contingencies && Object.keys(extraction.contingencies).length > 0) {
    console.log(`[role-detection] Chunk ${chunkIndex + 1}: Has contingencies → likely counter_offer`);
    return 'counter_offer';
  }

  // Default to counter_offer for later chunks (safer assumption)
  console.log(`[role-detection] Chunk ${chunkIndex + 1}: Default to counter_offer for later chunk`);
  return 'counter_offer';
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

  // If no substantive data, return early
  if (substantiveExtractions.length === 0) {
    return {
      finalTerms: {},
      needsReview: true,
      criticalPages: [],
      allExtractions: [],
    };
  }

  // Detect main contract price for role detection
  const mainContractPrice = substantiveExtractions[0]?.purchasePrice || null;

  // Convert chunks to PerPageExtraction format with role detection
  const pageExtractions: PerPageExtraction[] = [];
  const criticalPageNumbers: number[] = [];
  const pageLabels: Record<number, string> = {};

  let pageNumberCounter = 1;

  for (let i = 0; i < substantiveExtractions.length; i++) {
    const extraction = substantiveExtractions[i];
    const role = detectPageRole(extraction, i, mainContractPrice);

    // Remove sourcePage before treating as PerPageExtraction
    const { sourcePage, ...extractionData } = extraction;

    // Add to arrays
    pageExtractions.push(extractionData);
    criticalPageNumbers.push(pageNumberCounter);

    // Create page label based on detected role
    let labelPrefix = 'MAIN';
    if (role === 'counter_offer') {
      labelPrefix = 'COUNTER';
    } else if (role === 'addendum') {
      labelPrefix = 'ADDENDUM';
    }

    pageLabels[pageNumberCounter] = `${labelPrefix} PAGE ${i + 1} (chunk ${sourcePage})`;

    console.log(`[extractPdf] Chunk ${i + 1} (pages ${sourcePage}) → pageNumber ${pageNumberCounter}, role: ${role}`);

    pageNumberCounter++;
  }

  // Call post-processor with proper metadata
  console.log(`[extractPdf] Calling post-processor with ${pageExtractions.length} page extractions`);

  const mergeResult = await mergePageExtractions(pageExtractions, {
    criticalPageNumbers,
    pageLabels,
    packageMetadata: {
      totalPages,
      pdfUrl,
      extractionMethod: 'mistral-batched-with-roles',
    },
  });

  return {
    finalTerms: mergeResult.finalTerms,
    needsReview: mergeResult.needsReview,
    criticalPages,
    allExtractions: substantiveExtractions,
  };
}