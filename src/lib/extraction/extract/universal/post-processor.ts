// TC Helper App
// src/lib/extraction/extract/universal/post-processor.ts
// Version: 7.0.0 - 2026-01-05
// REFACTORED: Simplified pipeline using role-based allowlist merge (safe & predictable)

import type { PerPageExtraction, EnrichedPageExtraction, MergeResult } from '@/types/extraction';
import { enrichWithMetadata } from './helpers/enrichment';
import { coerceAllTypes } from './helpers/type-coercion';
import { calculateEffectiveDate, normalizeDates } from './helpers/date-utils';
import { mergeWithAllowlist } from './helpers/merge'; // ← New unified merge
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
    finalTerms.propertyAddress = addressValidation.correctedAddress;
    mergeLog.push(`✅ Address updated to Mapbox-verified version`);
  } else if (addressValidation.needsReview) {
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
// MERGE PIPELINE — SIMPLIFIED & SAFE
// ============================================================================

function executeMergePipeline(
  enrichedPages: EnrichedPageExtraction[],
  provenance: Record<string, number>,
  mergeLog: string[]
): Record<string, any> {
  mergeLog.push(`[post-processor] Using role-based allowlist merge for safe field selection`);

  // Single, unified merge using explicit allowlist
  let finalTerms = mergeWithAllowlist(enrichedPages, provenance, mergeLog);

  // Type coercion
  console.log(`[post-processor] Coercing types...`);
  finalTerms = coerceAllTypes(finalTerms, mergeLog);

  // Effective date calculation (from signatures)
  console.log(`[post-processor] Calculating effective date...`);
  finalTerms.effectiveDate = calculateEffectiveDate(enrichedPages, mergeLog);
  if (finalTerms.effectiveDate) {
    mergeLog.push(`📅 effectiveDate calculated: ${finalTerms.effectiveDate}`);
  }

  // Date normalization (handles various formats)
  console.log(`[post-processor] Normalizing dates...`);
  finalTerms = normalizeDates(finalTerms, mergeLog);

  return finalTerms;
}