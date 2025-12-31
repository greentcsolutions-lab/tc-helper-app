// src/lib/extraction/extract/universal/index.ts
// Version: 13.0.0 - 2025-12-31
// LEAN: Extraction now returns pure data, post-processor enriches with classification metadata

import type { LabeledCriticalImage } from '@/types/classification';
import type { UniversalExtractionResult } from '@/types/extraction';
import { buildUniversalExtractorPrompt } from '../../prompts/universal-extractor-prompt';
import { mergePageExtractions, type PerPageExtraction } from './post-processor';
import { callGrokAPI, type GrokPage } from '@/lib/grok/client';

export async function universalExtractor(
  criticalImages: LabeledCriticalImage[],
  packageMetadata: any,
  classificationMetadata: {
    criticalPageNumbers: number[];
    pageLabels: Record<number, string>;
    packageMetadata: any;
  }
): Promise<{
  universal: UniversalExtractionResult;
  details: {
    provenance: Record<string, number>;
    pageExtractions: any[];
    mergeLog: string[];
    validationErrors: string[];
    validationWarnings: string[];
  } | null;
  timelineEvents: any[];
  needsReview: boolean;
}> {
  console.log(`\n${"═".repeat(80)}`);
  console.log(`║ 🤖 UNIVERSAL EXTRACTOR STARTED (PURE OCR MODE)`);
  console.log(`${"═".repeat(80)}`);
  console.log(`[extractor] Critical images: ${criticalImages.length}`);
  
  // PHASE 1: PER-PAGE EXTRACTION (Pure OCR - no classification metadata)
  console.log(`\n[extractor:phase1] ${"─".repeat(60)}`);
  console.log(`[extractor:phase1] PHASE 1: PURE PER-PAGE EXTRACTION`);
  console.log(`[extractor:phase1] ${"─".repeat(60)}`);
  console.log(`[extractor:phase1] Starting pure OCR extraction...`);
  
  const pageExtractions = await extractPerPage(criticalImages);
  
  console.log(`[extractor:phase1] ✅ Extracted ${pageExtractions.length} pages`);
  console.log(`\n[extractor:debug] ${"─".repeat(60)}`);
  console.log(`[extractor:debug] RAW PER-PAGE EXTRACTIONS (LEAN)`);
  console.log(`[extractor:debug] ${"─".repeat(60)}`);
  
  pageExtractions.forEach((extraction, idx) => {
    console.log(`\n[extractor:debug] Array index ${idx}:`);
    console.log(`  Corresponds to PDF page: ${classificationMetadata.criticalPageNumbers[idx]}`);
    console.log(`  Label: ${classificationMetadata.pageLabels[classificationMetadata.criticalPageNumbers[idx]]}`);
    console.log(`  Confidence: ${extraction.confidence.overall}`);
    
    const fieldsWithData = Object.entries(extraction)
      .filter(([key, value]) => 
        key !== 'confidence' &&
        value != null &&
        (typeof value !== 'object' || Object.keys(value).length > 0) &&
        (!Array.isArray(value) || value.length > 0)
      );
    
    if (fieldsWithData.length > 0) {
      console.log(`  Fields with data (${fieldsWithData.length}):`);
      fieldsWithData.forEach(([key]) => console.log(`    - ${key}`));
    } else {
      console.log(`  No data fields extracted`);
    }
  });
  
  // PHASE 2: MERGE + POST-PROCESS (now passes classification metadata)
  console.log(`\n[extractor:phase2] ${"─".repeat(60)}`);
  console.log(`[extractor:phase2] PHASE 2: MERGE & POST-PROCESS`);
  console.log(`[extractor:phase2] ${"─".repeat(60)}`);
  console.log(`[extractor:phase2] Starting merge process with classification metadata...`);
  
  const mergeResult = mergePageExtractions(pageExtractions, classificationMetadata);
  
  console.log(`[extractor:phase2] ✅ Merge complete`);
  console.log(`[extractor:phase2] Needs review: ${mergeResult.needsReview}`);
  console.log(`[extractor:phase2] Validation errors: ${mergeResult.validationErrors.length}`);
  console.log(`[extractor:phase2] Validation warnings: ${mergeResult.validationWarnings.length}`);
  
  // Return first-pass results
  console.log(`\n${"═".repeat(80)}`);
  console.log(`║ ✅ UNIVERSAL EXTRACTION COMPLETE (SINGLE PASS)`);
  console.log(`${"═".repeat(80)}\n`);
  
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
 * Extract data using LEAN schema (no classification fields)
 * v13.0.0: Grok only returns data fields, classification metadata comes from cache
 */
async function extractPerPage(
  criticalImages: LabeledCriticalImage[]
): Promise<PerPageExtraction[]> {
  const prompt = buildUniversalExtractorPrompt(criticalImages);
  
  console.log(`[extractor:api] Prompt length: ${prompt.length} chars`);
  console.log(`[extractor:api] Sending ${criticalImages.length} images to Grok`);
  
  // Convert to GrokPage format (minimal interface)
  const pages: GrokPage[] = criticalImages.map(img => ({
    pageNumber: img.pageNumber,
    base64: img.base64,
  }));
  
  // Call using EXACT classifier pattern
  // This will format images as: "━━━ IMAGE 1 OF 11 = PDF_Page_5 ━━━"
  // Note: We don't pass totalPagesInDocument because extractor only sees critical pages
  const result = await callGrokAPI<PerPageExtraction[]>(
    prompt,
    pages,
    {
      logPrefix: '[extractor',
      model: 'grok-4-1-fast-reasoning',
      temperature: 0,
      maxTokens: 4096,
      expectObject: false, // Expecting array []
    }
    // totalPagesInDocument is undefined - only classifier knows this
  );
  
  console.log(`[extractor] ✅ Successfully extracted ${result.length} pages`);
  
  return result;
}