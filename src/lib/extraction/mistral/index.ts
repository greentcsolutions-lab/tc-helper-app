// src/lib/extraction/mistral/index.ts
// Version: 2.1.0 - 2026-01-05
// Fully switched to Vercel Blob public URLs only (no base64 fallback)

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
 * Main Mistral extractor – uses only public Vercel Blob URLs
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

  // Sort images by pageNumber ascending
  const sortedImages = [...highResCriticalImages].sort((a, b) => a.pageNumber - b.pageNumber);

  const chunkImages: ChunkImage[] = sortedImages.map((img) => ({
    pageNumber: img.pageNumber,
    label: img.label,
    pageRole: 'unknown',
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

    // Assemble PDF → upload to Vercel Blob → get public URL + mapping
    const { url: pdfUrl, pageMapping } = await assemblePdfChunk(chunk, {
      pathname: `extracts/temp/chunk-${Date.now()}-${chunkIndex}.pdf`,
      addRandomSuffix: true,
    });

    // Call Mistral with ONLY the public URL
    const response = await callMistralChunk(pdfUrl, chunk.length);

    // Map per-page extractions back to original document context
    const perPageExtractions: PerPageExtraction[] = response.extractions.map((ext, idx) => {
      const mapping = pageMapping[idx];
      return {
        ...ext,
        // pageNumber, label, pageRole enriched later in post-processor
      };
    });

    // Optional: clean up the temporary blob after successful extraction
    // import { del } from '@vercel/blob';
    // del(pdfUrl).catch(() => {}); // fire-and-forget

    return { perPageExtractions, pageMapping };
  });

  const chunkResults = await Promise.allSettled(chunkPromises);

  // Collect results
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

  const mergeResult: MergeResult = await mergePageExtractions(allPerPage, classificationMetadata);

  console.log('[mistral] Post-processor complete');
  console.log(`[mistral] needsReview: ${mergeResult.needsReview}`);

  return {
    universal: mergeResult.finalTerms,
    details: {
      provenance: mergeResult.provenance,
      pageExtractions: mergeResult.pageExtractions,
    },
    timelineEvents: [],
    needsReview: mergeResult.needsReview,
  };
}