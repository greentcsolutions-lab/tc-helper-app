// src/lib/extraction/extract/universal/post-processor.ts
// Version: 1.0.1 - 2025-12-29
// FIXED: TypeScript errors with dynamic property access using type-safe Record approach

import type { UniversalExtractionResult } from '@/types/extraction';

export interface PerPageExtraction {
  pageNumber: number;
  pageLabel: string;
  formCode: string;
  formPage: number | null;
  pageRole: 'main_contract' | 'counter_offer' | 'addendum' | 'signatures' | 'broker_info';
  buyerNames?: string[] | null;
  sellerNames?: string[] | null;
  propertyAddress?: string | null;
  purchasePrice?: number | null;
  earnestMoneyDeposit?: {
    amount: number | null;
    holder: string | null;
  } | null;
  closingDate?: string | number | null;
  financing?: {
    isAllCash: boolean | null;
    loanType: string | null;
    loanAmount: number | null;
  } | null;
  contingencies?: {
    inspectionDays: number | string | null;
    appraisalDays: number | string | null;
    loanDays: number | string | null;
    saleOfBuyerProperty: boolean | null;
  } | null;
  closingCosts?: {
    buyerPays: string[] | null;
    sellerPays: string[] | null;
    sellerCreditAmount: number | null;
  } | null;
  brokers?: {
    listingBrokerage: string | null;
    listingAgent: string | null;
    sellingBrokerage: string | null;
    sellingAgent: string | null;
  } | null;
  personalPropertyIncluded?: string[] | null;
  effectiveDate?: string | null;
  escrowHolder?: string | null;
  confidence: {
    overall: number;
    fieldScores?: Record<string, number>;
  };
}

export interface MergeResult {
  finalTerms: UniversalExtractionResult;
  provenance: Record<string, number>;
  needsReview: boolean;
  needsSecondTurn: boolean;
  mergeLog: string[];
  validationErrors: string[];
  validationWarnings: string[];
}

/**
 * Merges per-page extractions into final contract terms
 * Applies deterministic override logic (counters > addenda > RPA)
 */
export function mergePageExtractions(
  pageExtractions: PerPageExtraction[]
): MergeResult {
  console.log(`\n[post-processor] ${"═".repeat(60)}`);
  console.log(`[post-processor] STARTING MERGE PROCESS`);
  console.log(`[post-processor] ${"═".repeat(60)}`);
  console.log(`[post-processor] Processing ${pageExtractions.length} page extractions`);
  
  const mergeLog: string[] = [];
  const provenance: Record<string, number> = {};
  
  // STEP 1: Build baseline from main contract pages
  const rpaPages = pageExtractions.filter(p => p.pageRole === 'main_contract');
  console.log(`[post-processor] Step 1: Found ${rpaPages.length} main contract pages`);
  
  let finalTerms = mergePages(rpaPages, 'MAIN_CONTRACT', provenance, mergeLog);
  
  // STEP 2: Apply counter offer overrides
  const counterPages = pageExtractions.filter(p => p.pageRole === 'counter_offer');
  
  if (counterPages.length > 0) {
    console.log(`[post-processor] Step 2: Applying ${counterPages.length} counter offer overrides`);
    finalTerms = applyOverrides(finalTerms, counterPages, 'COUNTER_OFFER', provenance, mergeLog);
  } else {
    console.log(`[post-processor] Step 2: No counter offers found`);
  }
  
  // STEP 3: Apply addendum modifications
  const addendumPages = pageExtractions.filter(p => p.pageRole === 'addendum');
  
  if (addendumPages.length > 0) {
    console.log(`[post-processor] Step 3: Applying ${addendumPages.length} addendum modifications`);
    finalTerms = applyOverrides(finalTerms, addendumPages, 'ADDENDUM', provenance, mergeLog);
  } else {
    console.log(`[post-processor] Step 3: No addenda found`);
  }
  
  // STEP 4: Apply signature page data (effective date)
  const signaturePages = pageExtractions.filter(p => p.pageRole === 'signatures');
  
  if (signaturePages.length > 0) {
    console.log(`[post-processor] Step 4: Merging ${signaturePages.length} signature pages`);
    finalTerms = applyOverrides(finalTerms, signaturePages, 'SIGNATURES', provenance, mergeLog);
  } else {
    console.log(`[post-processor] Step 4: No signature pages found`);
  }
  
  // STEP 5: Apply broker info
  const brokerPages = pageExtractions.filter(p => p.pageRole === 'broker_info');
  
  if (brokerPages.length > 0) {
    console.log(`[post-processor] Step 5: Merging ${brokerPages.length} broker info pages`);
    finalTerms = applyOverrides(finalTerms, brokerPages, 'BROKER_INFO', provenance, mergeLog);
  } else {
    console.log(`[post-processor] Step 5: No broker info pages found`);
  }
  
  // STEP 6: Normalize dates
  console.log(`[post-processor] Step 6: Normalizing dates...`);
  finalTerms = normalizeDates(finalTerms, mergeLog);
  
  // STEP 7: Validate critical fields
  console.log(`[post-processor] Step 7: Validating extracted terms...`);
  const validation = validateExtractedTerms(finalTerms, mergeLog);
  
  console.log(`\n[post-processor] ${"═".repeat(60)}`);
  console.log(`[post-processor] MERGE COMPLETE`);
  console.log(`[post-processor] ${"═".repeat(60)}`);
  console.log(`[post-processor] Needs review: ${validation.needsReview}`);
  console.log(`[post-processor] Needs second turn: ${validation.needsSecondTurn}`);
  console.log(`[post-processor] Validation errors: ${validation.errors.length}`);
  console.log(`[post-processor] Validation warnings: ${validation.warnings.length}`);
  console.log(`[post-processor] Merge log entries: ${mergeLog.length}`);
  console.log(`[post-processor] ${"═".repeat(60)}\n`);
  
  return {
    finalTerms: finalTerms as UniversalExtractionResult,
    provenance,
    needsReview: validation.needsReview,
    needsSecondTurn: validation.needsSecondTurn,
    mergeLog,
    validationErrors: validation.errors,
    validationWarnings: validation.warnings,
  };
}

/**
 * Merges multiple pages of the same type (e.g., RPA pages 1-3)
 */
function mergePages(
  pages: PerPageExtraction[],
  source: string,
  provenance: Record<string, number>,
  log: string[]
): Record<string, any> {
  const merged: Record<string, any> = {};
  
  for (const page of pages) {
    // Create a mutable copy as Record for safe iteration
    const pageData: Record<string, any> = { ...page };
    delete pageData.pageNumber;
    delete pageData.pageLabel;
    delete pageData.formCode;
    delete pageData.formPage;
    delete pageData.pageRole;
    delete pageData.confidence;
    
    for (const [key, value] of Object.entries(pageData)) {
      if (value != null && !isEmpty(value)) {
        if (merged[key] == null) {
          merged[key] = value;
          provenance[key] = page.pageNumber;
          log.push(`✓ ${key} from ${source} page ${page.pageNumber}`);
        } else {
          // Prefer later pages (more likely to have complete info)
          if (page.pageNumber > provenance[key]) {
            log.push(`↻ ${key} updated from ${source} page ${page.pageNumber} (was page ${provenance[key]})`);
            merged[key] = value;
            provenance[key] = page.pageNumber;
          }
        }
      }
    }
  }
  
  return merged;
}

/**
 * Applies overrides from counter offers or addenda
 */
function applyOverrides(
  baseline: Record<string, any>,
  overridePages: PerPageExtraction[],
  source: string,
  provenance: Record<string, number>,
  log: string[]
): Record<string, any> {
  const result = { ...baseline };
  
  for (const page of overridePages) {
    // Create a mutable copy as Record for safe iteration
    const pageData: Record<string, any> = { ...page };
    delete pageData.pageNumber;
    delete pageData.pageLabel;
    delete pageData.formCode;
    delete pageData.formPage;
    delete pageData.pageRole;
    delete pageData.confidence;
    
    for (const [key, value] of Object.entries(pageData)) {
      if (value != null && !isEmpty(value)) {
        const hadPrevious = result[key] != null;
        result[key] = value;
        provenance[key] = page.pageNumber;
        
        if (hadPrevious) {
          log.push(`⚠️ ${key} OVERRIDDEN by ${source} page ${page.pageNumber}`);
        } else {
          log.push(`✓ ${key} from ${source} page ${page.pageNumber}`);
        }
      }
    }
  }
  
  return result;
}

/**
 * Normalizes date formats (days → actual dates where possible)
 */
function normalizeDates(
  terms: Record<string, any>,
  log: string[]
): Record<string, any> {
  const acceptanceDate = terms.effectiveDate;
  
  if (!acceptanceDate) {
    log.push('⚠️ No effective date found - cannot normalize relative dates');
    return terms;
  }
  
  // Normalize closingDate
  if (terms.closingDate != null) {
    const normalized = normalizeSingleDate(terms.closingDate, acceptanceDate);
    if (normalized !== terms.closingDate) {
      log.push(`📅 closingDate normalized: ${terms.closingDate} → ${normalized}`);
      terms.closingDate = normalized;
    }
  }
  
  // Normalize contingency dates
  if (terms.contingencies) {
    const cont = terms.contingencies;
    
    if (cont.inspectionDays != null) {
      const normalized = normalizeSingleDate(cont.inspectionDays, acceptanceDate);
      if (normalized !== cont.inspectionDays) {
        log.push(`📅 inspectionDays normalized: ${cont.inspectionDays} → ${normalized}`);
        cont.inspectionDays = normalized;
      }
    }
    
    if (cont.appraisalDays != null) {
      const normalized = normalizeSingleDate(cont.appraisalDays, acceptanceDate);
      if (normalized !== cont.appraisalDays) {
        log.push(`📅 appraisalDays normalized: ${cont.appraisalDays} → ${normalized}`);
        cont.appraisalDays = normalized;
      }
    }
    
    if (cont.loanDays != null) {
      const normalized = normalizeSingleDate(cont.loanDays, acceptanceDate);
      if (normalized !== cont.loanDays) {
        log.push(`📅 loanDays normalized: ${cont.loanDays} → ${normalized}`);
        cont.loanDays = normalized;
      }
    }
  }
  
  return terms;
}

function normalizeSingleDate(
  value: number | string,
  acceptanceDate: string
): number | string {
  // If it's already a date string (YYYY-MM-DD), leave it
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  
  // If it's "Waived" or other text, leave it
  if (typeof value === 'string' && isNaN(Number(value))) {
    return value;
  }
  
  // If it's a number, calculate the actual date
  const days = typeof value === 'number' ? value : parseInt(value);
  
  if (!isNaN(days)) {
    return addBusinessDays(new Date(acceptanceDate), days);
  }
  
  return value;
}

function addBusinessDays(startDate: Date, days: number): string {
  let current = new Date(startDate);
  let added = 0;
  
  while (added < days) {
    current.setDate(current.getDate() + 1);
    // Skip weekends (0 = Sunday, 6 = Saturday)
    if (current.getDay() !== 0 && current.getDay() !== 6) {
      added++;
    }
  }
  
  return current.toISOString().split('T')[0];  // YYYY-MM-DD
}

/**
 * Validates that critical fields are present and make logical sense
 */
function validateExtractedTerms(
  terms: Record<string, any>,
  log: string[]
): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  needsReview: boolean;
  needsSecondTurn: boolean;
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  let needsReview = false;
  let needsSecondTurn = false;
  
  console.log(`\n[validator] ${"═".repeat(60)}`);
  console.log(`[validator] VALIDATING EXTRACTED TERMS`);
  console.log(`[validator] ${"═".repeat(60)}`);
  
  // === HARD VALIDATION (critical errors) ===
  
  // 1. Purchase price = 0 → EXTRACTION FAILED
  if (terms.purchasePrice === 0) {
    errors.push('Purchase price is $0 (extraction failed)');
    needsSecondTurn = true;
    console.error(`[validator] ❌ Purchase price is $0 → triggering second turn`);
  }
  
  // 2. Purchase price < earnest money → LOGIC ERROR
  if (terms.purchasePrice && terms.purchasePrice > 0 && 
      terms.earnestMoneyDeposit?.amount && 
      terms.purchasePrice < terms.earnestMoneyDeposit.amount) {
    errors.push(`Purchase price ($${terms.purchasePrice.toLocaleString()}) < earnest money ($${terms.earnestMoneyDeposit.amount.toLocaleString()})`);
    needsReview = true;
    console.error(`[validator] ❌ Purchase price < earnest money`);
  }
  
  // 3. Purchase price < loan amount → LOGIC ERROR
  if (terms.purchasePrice && terms.purchasePrice > 0 &&
      terms.financing?.loanAmount &&
      terms.purchasePrice < terms.financing.loanAmount) {
    errors.push(`Purchase price ($${terms.purchasePrice.toLocaleString()}) < loan amount ($${terms.financing.loanAmount.toLocaleString()})`);
    needsReview = true;
    console.error(`[validator] ❌ Purchase price < loan amount`);
  }
  
  // 4. All cash but has loan type → LOGIC ERROR
  if (terms.financing?.isAllCash === true && terms.financing?.loanType) {
    warnings.push(`Marked as all cash but has loan type: ${terms.financing.loanType}`);
    needsReview = true;
    console.warn(`[validator] ⚠️ All cash but has loan type`);
  }
  
  // 5. Has loan but marked all cash → LOGIC ERROR
  if (terms.financing?.isAllCash === false && !terms.financing?.loanType) {
    warnings.push('Not all cash but no loan type specified');
    needsReview = true;
    console.warn(`[validator] ⚠️ Not all cash but no loan type`);
  }
  
  // === SOFT VALIDATION (Tier 1 fields) ===
  
  // 6. Missing property address
  if (!terms.propertyAddress || terms.propertyAddress.trim() === '') {
    errors.push('Property address is missing');
    needsReview = true;
    needsSecondTurn = true;
    console.error(`[validator] ❌ Property address missing`);
  }
  
  // 7. Missing buyer names
  if (!terms.buyerNames || terms.buyerNames.length === 0) {
    errors.push('No buyer names found');
    needsReview = true;
    console.error(`[validator] ❌ Buyer names missing`);
  }
  
  // 8. Missing earnest money
  if (!terms.earnestMoneyDeposit?.amount) {
    warnings.push('Earnest money deposit amount is missing');
    needsReview = true;
    console.warn(`[validator] ⚠️ Earnest money missing`);
  }
  
  // 9. Missing closing date
  if (!terms.closingDate) {
    warnings.push('Closing date is missing');
    needsReview = true;
    console.warn(`[validator] ⚠️ Closing date missing`);
  }
  
  // === INFORMATIONAL (Tier 2 fields) ===
  
  // 10. Missing financing terms
  if (!terms.financing) {
    warnings.push('Financing terms not found');
    console.log(`[validator] ℹ️ Financing terms not found`);
  }
  
  // 11. Missing broker info
  if (!terms.brokers) {
    warnings.push('Broker information not found');
    console.log(`[validator] ℹ️ Broker info not found`);
  }
  
  console.log(`[validator] ${"═".repeat(60)}`);
  console.log(`[validator] Validation complete:`);
  console.log(`[validator]   Errors: ${errors.length}`);
  console.log(`[validator]   Warnings: ${warnings.length}`);
  console.log(`[validator]   Needs review: ${needsReview}`);
  console.log(`[validator]   Needs second turn: ${needsSecondTurn}`);
  console.log(`[validator] ${"═".repeat(60)}\n`);
  
  // Add to merge log
  if (errors.length > 0) {
    errors.forEach(e => log.push(`❌ ERROR: ${e}`));
  }
  if (warnings.length > 0) {
    warnings.forEach(w => log.push(`⚠️ WARNING: ${w}`));
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    needsReview,
    needsSecondTurn,
  };
}

/**
 * Helper: Check if a value is "empty" (null, undefined, empty array, empty object, empty string)
 */
function isEmpty(value: any): boolean {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}