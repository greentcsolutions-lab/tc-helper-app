// src/lib/extraction/mistral/extractPdf.ts
// Version: 2.0.0 - 2026-01-08
// SIMPLIFIED: Extracts ALL pages in 8-page batches (no classification needed)
// Sends full PDF URL with page ranges to Mistral (avoids pdf-lib corruption issues)
// Filters results by data quality (non-empty extractions)
// Parallel execution with Promise.all
// Replaces classification-based filtering with data-presence filtering

import { mistralExtractorSchema } from './schema';

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/ocr';
const API_KEY = process.env.MISTRAL_API_KEY!;

if (!API_KEY) {
  throw new Error('MISTRAL_API_KEY is required');
}

interface ExtractionChunk {
  pageNumbers: number[];
  extractions: any[];
}

// Helper: Check if an extraction has substantive data
function hasSubstantiveData(extraction: any): boolean {
  if (!extraction) return false;

  // Check for key transaction fields
  const hasPrice = extraction.purchasePrice || extraction.listPrice;
  const hasDates = extraction.closingDate || extraction.acceptanceDate || extraction.effectiveDate;
  const hasParties = extraction.buyerNames?.length > 0 || extraction.sellerNames?.length > 0;
  const hasProperty = extraction.propertyAddress;
  const hasTerms = extraction.earnestMoneyDeposit || extraction.contingencies?.length > 0;
  const hasSignatures = extraction.signatures?.length > 0;

  // Page is substantive if it has at least 2 key fields
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
  criticalPages: number[];
  allExtractions: any[];
}> {
  console.log(`[extractPdf] Extracting all ${totalPages} pages in batches of 8 (parallel)`);

  // Generate all page numbers
  const allPageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);

  // Split into chunks of 8 pages max
  const chunks: number[][] = [];
  for (let i = 0; i < allPageNumbers.length; i += 8) {
    chunks.push(allPageNumbers.slice(i, i + 8));
  }

  console.log(`[extractPdf] ${totalPages} pages → ${chunks.length} chunk(s) of ≤8 pages`);

  // Parallel execution - each chunk gets the full PDF URL
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

  console.log(`[extractPdf] Total ${allPageExtractions.length} page extractions received`);

  // Filter by data quality - keep only pages with substantive data
  const substantiveExtractions = allPageExtractions.filter((ext, idx) => {
    const isSubstantive = hasSubstantiveData(ext);
    if (!isSubstantive) {
      console.log(`[extractPdf] Filtering out page ${ext.sourcePage} - no substantive data`);
    }
    return isSubstantive;
  });

  const criticalPages = substantiveExtractions.map(ext => ext.sourcePage);

  console.log(
    `[extractPdf] Filtered ${allPageExtractions.length} → ${substantiveExtractions.length} substantive pages: [${criticalPages.join(', ')}]`
  );

  // Build minimal metadata for post-processor
  const classificationMetadata = {
    criticalPageNumbers: criticalPages,
    pageLabels: {},
    packageMetadata: {},
  };

  // Simple merge - no complex classification logic needed
  const finalTerms: any = {};
  const provenance: Record<string, number> = {};

  // Merge all substantive extractions
  for (const extraction of substantiveExtractions) {
    for (const [key, value] of Object.entries(extraction)) {
      if (key === 'sourcePage') continue;
      if (value && value !== null && value !== undefined) {
        if (Array.isArray(value) && value.length === 0) continue;

        // Simple last-write-wins for now
        finalTerms[key] = value;
        provenance[key] = extraction.sourcePage;
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