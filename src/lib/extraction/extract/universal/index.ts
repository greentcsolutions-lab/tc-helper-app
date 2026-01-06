// src/lib/extraction/extract/universal/index.ts
// Version: 13.0.0 - 2025-12-31
// FIXED: Import PerPageExtraction from @/types/extraction (not post-processor)
// Deprecated Universal Extractor using Mistral AI for extraction

import type { LabeledCriticalImage } from '@/types/classification';
import type { UniversalExtractionResult, PerPageExtraction } from '@/types/extraction';
import { buildUniversalExtractorPrompt } from '../../prompts/universal-extractor-prompt';
import { mergePageExtractions } from './post-processor';
import { callGrokAPI, type GrokPage } from '@/lib/grok/client';

export async function universalExtractor(
  criticalImages: LabeledCriticalImage[],
  classificationMetadata: {
    criticalPageNumbers: number[];
    pageLabels: Record<number, string>;
    packageMetadata: any;
  }
): Promise<{
  universal: UniversalExtractionResult;
  details: {
    provenance: Record<string, number>;
    pageExtractions: PerPageExtraction[];
    mergeLog: string[];
    validationErrors: string[];
    validationWarnings: string[];
  } | null;
  timelineEvents: any[];
  needsReview: boolean;
}> {
  console.log(`\n${"═".repeat(80)}`);
  console.log(`║ 🤖 UNIVERSAL EXTRACTOR STARTED (LEAN EXTRACTION)`);
  console.log(`${"═".repeat(80)}`);
  console.log(`[extractor] Critical images: ${criticalImages.length}`);
  
  // PHASE 1: PER-PAGE EXTRACTION (Pure OCR - no context pollution)
  console.log(`\n[extractor:phase1] ${"─".repeat(60)}`);
  console.log(`[extractor:phase1] PHASE 1: LEAN PER-PAGE EXTRACTION`);
  console.log(`[extractor:phase1] ${"─".repeat(60)}`);
  console.log(`[extractor:phase1] Starting lean extraction (no classification in schema)...`);
  
  const pageExtractions = await extractPerPage(criticalImages);
  
  console.log(`[extractor:phase1] ✅ Extracted ${pageExtractions.length} pages`);
  
  // Log array index to PDF page mapping
  console.log(`\n[extractor:debug] ${"─".repeat(60)}`);
  console.log(`[extractor:debug] ARRAY INDEX → PDF PAGE MAPPING`);
  console.log(`[extractor:debug] ${"─".repeat(60)}`);
  pageExtractions.forEach((extraction, idx) => {
    console.log(`[extractor:debug] Array[${idx}] → PDF Page ${classificationMetadata.criticalPageNumbers[idx]}`);
  });
  
  // PHASE 2: MERGE WITH CLASSIFICATION METADATA
  console.log(`\n[extractor:phase2] ${"─".repeat(60)}`);
  console.log(`[extractor:phase2] PHASE 2: MERGING PAGE EXTRACTIONS`);
  console.log(`[extractor:phase2] ${"─".repeat(60)}`);

  const mergeResult = await mergePageExtractions(pageExtractions, classificationMetadata);
  
  console.log(`\n${"═".repeat(80)}`);
  console.log(`║ ✅ EXTRACTION COMPLETE`);
  console.log(`${"═".repeat(80)}`);
  console.log(`[extractor] Needs review: ${mergeResult.needsReview}`);
  console.log(`[extractor] Validation errors: ${mergeResult.validationErrors.length}`);
  console.log(`[extractor] Validation warnings: ${mergeResult.validationWarnings.length}`);
  
  return {
    universal: mergeResult.finalTerms,
    details: {
      provenance: mergeResult.provenance,
      pageExtractions: mergeResult.pageExtractions,
      mergeLog: mergeResult.mergeLog,
      validationErrors: mergeResult.validationErrors,
      validationWarnings: mergeResult.validationWarnings,
    },
    timelineEvents: [],
    needsReview: mergeResult.needsReview,
  };
}

/**
 * Extract data using lean schema (no classification metadata)
 * v13.0.0: Returns PerPageExtraction[] (lean - no classification fields)
 */
async function extractPerPage(
  criticalImages: LabeledCriticalImage[]
): Promise<PerPageExtraction[]> {
  const prompt = buildUniversalExtractorPrompt(criticalImages);
  
  console.log(`[extractor:api] Prompt length: ${prompt.length} chars`);
  console.log(`[extractor:api] Sending ${criticalImages.length} images to Grok`);
  console.log(`[extractor:api] Using LEAN schema (no classification metadata)`);
  
  // Convert to GrokPage format (minimal interface)
  const pages: GrokPage[] = criticalImages.map(img => ({
    pageNumber: img.pageNumber,
    base64: img.base64,
  }));
  
  // Call Grok API with lean schema
  // Grok returns PerPageExtraction[] (without pageNumber, pageLabel, formCode, etc.)
  const result = await callGrokAPI<PerPageExtraction[]>(
    prompt,
    pages,
    {
      logPrefix: '[extractor]',
      model: 'grok-4-1-fast-reasoning',
      temperature: 0,
      maxTokens: 16384,
      expectObject: false, // Expecting array []
    }
  );
  
  console.log(`[extractor] ✅ Successfully extracted ${result.length} pages (lean - no classification)`);
  
  return result;
}