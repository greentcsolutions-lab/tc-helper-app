// src/lib/extraction/extract/universal/post-processor.ts
// Version: 5.0.0 - 2025-12-31
// ENHANCED: Field-specific override rules with buyer/seller counter detection

import type { PerPageExtraction, EnrichedPageExtraction, MergeResult } from '@/types/extraction';
import { enrichWithMetadata } from './helpers/enrichment';
import { coerceAllTypes } from './helpers/type-coercion';
import { calculateEffectiveDate, normalizeDates } from './helpers/date-utils';
import { mergePages, applyOverrides } from './helpers/merge';
import { validateArrayLength, validateExtractedTerms } from './helpers/validation';

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

export function mergePageExtractions(
  pageExtractions: PerPageExtraction[],
  classificationMetadata: {
    criticalPageNumbers: number[];
    pageLabels: Record<string, string>;
    packageMetadata: any;
  }
): MergeResult {
  console.log(`\n[post-processor] ${"═".repeat(60)}`);
  console.log(`[post-processor] STARTING MERGE PROCESS`);
  console.log(`[post-processor] ${"═".repeat(60)}`);
  
  // STEP 1: Safety validation
  validateArrayLength(pageExtractions.length, classificationMetadata.criticalPageNumbers.length);
  
  // STEP 2: Enrich with classification metadata
  const enrichedPages = enrichWithMetadata(pageExtractions, classificationMetadata);
  console.log(`[post-processor] Enriched ${enrichedPages.length} pages`);
  
  // STEP 3: Execute merge pipeline
  const mergeLog: string[] = [];
  const provenance: Record<string, number> = {};
  
  let finalTerms = executeMergePipeline(enrichedPages, provenance, mergeLog);
  
  // STEP 4: Validate results
  const validation = validateExtractedTerms(finalTerms, mergeLog);
  
  console.log(`\n[post-processor] MERGE COMPLETE\n`);
  
  return {
    finalTerms: finalTerms as any, // Type assertion for UniversalExtractionResult
    provenance,
    pageExtractions: enrichedPages,
    needsReview: validation.needsReview,
    needsSecondTurn: validation.needsSecondTurn,
    mergeLog,
    validationErrors: validation.errors,
    validationWarnings: validation.warnings,
  };
}

// ============================================================================
// MERGE PIPELINE
// ============================================================================

function executeMergePipeline(
  enrichedPages: EnrichedPageExtraction[],
  provenance: Record<string, number>,
  mergeLog: string[]
): Record<string, any> {
  // Pipeline: Main Contract → Counters → Addenda → Signatures → Brokers → Coercion → Dates
  
  const steps = [
    { filter: (p: EnrichedPageExtraction) => p.pageRole === 'main_contract', name: 'MAIN_CONTRACT', isOverride: false },
    { filter: (p: EnrichedPageExtraction) => p.pageRole === 'counter_offer', name: 'COUNTER_OFFER', isOverride: true },
    { filter: (p: EnrichedPageExtraction) => p.pageRole === 'addendum', name: 'ADDENDUM', isOverride: true },
    { filter: (p: EnrichedPageExtraction) => p.pageRole === 'signatures', name: 'SIGNATURES', isOverride: true },
    { filter: (p: EnrichedPageExtraction) => p.pageRole === 'broker_info', name: 'BROKER_INFO', isOverride: true },
  ];
  
  let finalTerms: Record<string, any> = {};
  
  steps.forEach((step, index) => {
    const pages = enrichedPages.filter(step.filter);
    
    if (pages.length === 0) {
      console.log(`[post-processor] Step ${index + 1}: No ${step.name.toLowerCase()} pages found`);
      return;
    }
    
    console.log(`[post-processor] Step ${index + 1}: ${step.isOverride ? 'Applying' : 'Found'} ${pages.length} ${step.name.toLowerCase()} pages`);
    
    finalTerms = step.isOverride
      ? applyOverrides(finalTerms, pages, step.name, provenance, mergeLog, enrichedPages)
      : mergePages(pages, step.name, provenance, mergeLog);
  });
  
  // Type coercion
  console.log(`[post-processor] Step 6: Coercing types...`);
  finalTerms = coerceAllTypes(finalTerms, mergeLog);
  
  // Effective date calculation
  console.log(`[post-processor] Step 7: Calculating effective date...`);
  finalTerms.effectiveDate = calculateEffectiveDate(enrichedPages, mergeLog);
  if (finalTerms.effectiveDate) {
    mergeLog.push(`📅 effectiveDate calculated: ${finalTerms.effectiveDate}`);
  }
  
  // Date normalization
  console.log(`[post-processor] Step 8: Normalizing dates...`);
  finalTerms = normalizeDates(finalTerms, mergeLog);
  
  return finalTerms;
}