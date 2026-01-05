// src/lib/extraction/mistral/index.ts
// Version: 1.0.0 - 2026-01-05
// Orchestrator: Mistral extractor
// - Chunks ≤8 pages
// - Parallel calls to Mistral OCR (structured schema)
// - Merges results back into original page order
// - Reuses existing universal post-processor pipeline (merge, provenance, needsReview, etc.)

import { assemblePdfChunk, ChunkImage } from './assemblePdf';
import { callMistralChunk } from './mistralClient';
import { mergePageExtractions } from '@/lib/extraction/extract/universal/post-processor';

import type { LabeledCriticalImage } from '@/types/classification';
import type {
  PerPageExtraction,
  EnrichedPageExtraction,
  MergeResult,
  UniversalExtractionResult,
} from '@/types/extraction';

export interface MistralExtractorResult {
  universal: UniversalExtractionResult;
  details: {
    provenance: Record<string, number>;
    pageExtractions: EnrichedPageExtraction[];
    // Add confidence aggregates or other debug info later if needed
  } | null;
  timelineEvents: Array<{
    date: string;
    title: string;
    type: 'info' | 'warning' | 'critical';
    description?: string;
  }>;
  needsReview: boolean;
}

/**
 * Main Mistral extractor – replaces old universalExtractor
 * Input: high-DPI critical images + classification metadata
 * Output: shape compatible with router.ts expectations
 */
export async function mistralExtractor(
  highResCriticalImages: LabeledCriticalImage[],
  classificationMetadata: {
    criticalPageNumbers: number[];
    pageLabels: Record<number, string>;
    packageMetadata: any;
  }
): Promise<MistralExtractorResult> {
  console.log('[mistral] Starting extraction');
  console.log(`[mistral] Critical pages: ${highResCriticalImages.length}`);

  if (highResCriticalImages.length === 0) {
    throw new Error('No critical images provided');
  }

  // Sort images by pageNumber ascending (ensures consistent order matching criticalPageNumbers)
  const sortedImages = [...highResCriticalImages].sort((a, b) => a.pageNumber - b.pageNumber);

  // Enrich with pageRole – classificationMetadata doesn't have pageRole directly,
  // but post-processor enrichment will add it later. We only need pageNumber/label here.
  const chunkImages: ChunkImage[] = sortedImages.map((img) => ({
    pageNumber: img.pageNumber,
    label: img.label,
    pageRole: 'unknown', // placeholder – post-processor will override with correct role
    base64: img.base64,
  }));

  // Chunk into ≤8 pages
  const chunks: ChunkImage[][] = [];
  for (let i = 0; i < chunkImages.length; i += 8) {
    chunks.push(chunkImages.slice(i, i + 8));
  }

  console.log(`[mistral] Created ${chunks.length} chunk(s) (max 8 pages each)`);

  // Process chunks in parallel
  const chunkPromises = chunks.map(async (chunk, chunkIndex) => {
    console.log(`[mistral] Processing chunk ${chunkIndex + 1}/${chunks.length} (${chunk.length} pages)`);

    const { pdfBase64, pageMapping } = await assemblePdfChunk(chunk);

    const response = await callMistralChunk(pdfBase64, chunk.length);

    // Map Mistral's per-page extractions back to original page info
    const perPageExtractions: PerPageExtraction[] = response.extractions.map((ext, idx) => {
      const mapping = pageMapping[idx];
      return {
        ...ext,
        // Note: pageNumber/pageLabel/pageRole added later in post-processor enrichment
        // We keep raw extraction clean here
      };
    });

    return { perPageExtractions, pageMapping };
  });

  const chunkResults = await Promise.allSettled(chunkPromises);

  // Collect successful results + throw on any failure
  const allPerPage: PerPageExtraction[] = [];
  let totalPages = 0;

  for (const result of chunkResults) {
    if (result.status === 'rejected') {
      console.error('[mistral] Chunk failed:', result.reason);
      throw new Error(`Mistral chunk failed: ${result.reason}`);
    }

    const { perPageExtractions } = result.value;
    allPerPage.push(...perPageExtractions);
    totalPages += perPageExtractions.length;
  }

  if (totalPages !== sortedImages.length) {
    console.warn(`[mistral] Page count mismatch: expected ${sortedImages.length}, got ${totalPages}`);
  }

  console.log('[mistral] All chunks complete – running post-processor merge');

  // === REUSE EXISTING POST-PROCESSOR ===
  const mergeResult: MergeResult = await mergePageExtractions(allPerPage, classificationMetadata);

  console.log('[mistral] Post-processor complete');
  console.log(`[mistral] needsReview: ${mergeResult.needsReview}`);

  return {
    universal: mergeResult.finalTerms,
    details: {
      provenance: mergeResult.provenance,
      pageExtractions: mergeResult.pageExtractions,
    },
    timelineEvents: [], // Placeholder – can generate later if needed
    needsReview: mergeResult.needsReview,
  };
}