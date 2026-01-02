// TC Helper App
// src/lib/extraction/extract/universal/post-processor.ts
// Version: 6.0.0 - 2025-12-31
// FIXED: Removed 'signatures' step - signature sections are part of their parent documents

import type { PerPageExtraction, EnrichedPageExtraction, MergeResult } from '@/types/extraction';
import { enrichWithMetadata } from './helpers/enrichment';
import { coerceAllTypes } from './helpers/type-coercion';
import { calculateEffectiveDate, normalizeDates } from './helpers/date-utils';
import { mergePages, applyOverrides } from './helpers/merge';
import { validateArrayLength, validateExtractedTerms } from './helpers/validation';
import { validateAddress } from './helpers/address-validation';

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

export async function mergePageExtractions(
  pageExtractions: PerPageExtraction[],
  classificationMetadata: {
    criticalPageNumbers: number[];
    pageLabels: Record<string, string>;
    packageMetadata: any;
  }
): Promise<MergeResult> {
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

  // STEP 4: Validate and correct address using Mapbox
  const addressValidation = await validateAddress(finalTerms.propertyAddress, mergeLog);

  let addressNeedsReview = false;

  if (addressValidation.verified && addressValidation.correctedAddress) {
    // Use Mapbox-verified address as source of truth
    finalTerms.propertyAddress = addressValidation.correctedAddress;
    mergeLog.push(`✅ Address updated to Mapbox-verified version`);
  } else if (addressValidation.needsReview) {
    // Flag for review but keep original address
    addressNeedsReview = true;
    mergeLog.push(`⚠️ Address needs review: ${addressValidation.reviewReason}`);
  }

  // STEP 5: Validate results
  const validation = validateExtractedTerms(finalTerms, mergeLog);

  console.log(`\n[post-processor] MERGE COMPLETE\n`);

  return {
    finalTerms: finalTerms as any, // Type assertion for UniversalExtractionResult
    provenance,
    pageExtractions: enrichedPages,
    needsReview: validation.needsReview || addressNeedsReview,
    needsSecondTurn: validation.needsSecondTurn,
    mergeLog,
    validationErrors: validation.errors,
    validationWarnings: addressNeedsReview
      ? [...validation.warnings, `Address validation: ${addressValidation.reviewReason}`]
      : validation.warnings,
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
  // Pipeline: Main Contract → Counters → Addenda → Brokers → Coercion → Dates
  // REMOVED: Signatures step - signatures are part of their parent documents
  
  const steps = [
    { filter: (p: EnrichedPageExtraction) => p.pageRole === 'main_contract', name: 'MAIN_CONTRACT', isOverride: false },
    { filter: (p: EnrichedPageExtraction) => p.pageRole === 'counter_offer', name: 'COUNTER_OFFER', isOverride: true },
    { filter: (p: EnrichedPageExtraction) => p.pageRole === 'addendum', name: 'ADDENDUM', isOverride: true },
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
  console.log(`[post-processor] Step ${steps.length + 1}: Coercing types...`);
  finalTerms = coerceAllTypes(finalTerms, mergeLog);
  
  // Effective date calculation
  console.log(`[post-processor] Step ${steps.length + 2}: Calculating effective date...`);
  finalTerms.effectiveDate = calculateEffectiveDate(enrichedPages, mergeLog);
  if (finalTerms.effectiveDate) {
    mergeLog.push(`📅 effectiveDate calculated: ${finalTerms.effectiveDate}`);
  }
  
  // Date normalization
  console.log(`[post-processor] Step ${steps.length + 3}: Normalizing dates...`);
  finalTerms = normalizeDates(finalTerms, mergeLog);
  
  return finalTerms;
}