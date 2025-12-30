// src/lib/extraction/extract/universal/post-processor.ts
// Version: 3.0.0 - 2025-12-30
// REFACTORED: Type coercion moved to /lib/grok/type-coercion.ts
// This file now focuses purely on extraction-specific merge logic

import type { UniversalExtractionResult } from '@/types/extraction';
import {
  coerceNumber,
  coerceString,
  coerceStringArray,
  coerceBoolean,
  trackCoercion,
  isEmpty,
} from '@/lib/grok/type-coercion';

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
  pageExtractions: PerPageExtraction[];
  needsReview: boolean;
  needsSecondTurn: boolean;
  mergeLog: string[];
  validationErrors: string[];
  validationWarnings: string[];
}

// ============================================================================
// MAIN MERGE LOGIC
// ============================================================================

/**
 * Merges per-page extractions into final contract terms
 * Applies deterministic override logic (counters > addenda > RPA)
 * Now uses grok/type-coercion for consistent typing
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
  
  // STEP 6: TYPE COERCION (uses grok/type-coercion)
  console.log(`[post-processor] Step 6: Coercing types...`);
  finalTerms = coerceAllTypes(finalTerms, mergeLog);
  
  // STEP 7: Normalize dates (extraction-specific logic)
  console.log(`[post-processor] Step 7: Normalizing dates...`);
  finalTerms = normalizeDates(finalTerms, mergeLog);
  
  // STEP 8: Validate critical fields (extraction-specific logic)
  console.log(`[post-processor] Step 8: Validating extracted terms...`);
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
    pageExtractions,
    needsReview: validation.needsReview,
    needsSecondTurn: validation.needsSecondTurn,
    mergeLog,
    validationErrors: validation.errors,
    validationWarnings: validation.warnings,
  };
}

// ============================================================================
// TYPE COERCION (delegates to grok/type-coercion)
// ============================================================================

/**
 * Coerces all fields to correct types using grok/type-coercion utilities
 * Logs each coercion for debugging
 */
function coerceAllTypes(terms: Record<string, any>, log: string[]): Record<string, any> {
  console.log(`\n[coercion] ${"─".repeat(60)}`);
  console.log(`[coercion] COERCING TYPES (using grok/type-coercion)`);
  console.log(`[coercion] ${"─".repeat(60)}`);
  
  const coerced: Record<string, any> = { ...terms };
  let coercionCount = 0;
  
  // === SCALARS ===
  
  const buyersResult = trackCoercion(coerced.buyerNames, coerceStringArray(coerced.buyerNames), 'buyerNames');
  if (buyersResult.changed) { log.push(buyersResult.log!); coercionCount++; }
  coerced.buyerNames = buyersResult.value;
  
  const sellersResult = trackCoercion(coerced.sellerNames, coerceStringArray(coerced.sellerNames), 'sellerNames');
  if (sellersResult.changed) { log.push(sellersResult.log!); coercionCount++; }
  coerced.sellerNames = sellersResult.value;
  
  const addressResult = trackCoercion(coerced.propertyAddress, coerceString(coerced.propertyAddress), 'propertyAddress');
  if (addressResult.changed) { log.push(addressResult.log!); coercionCount++; }
  coerced.propertyAddress = addressResult.value;
  
  const priceResult = trackCoercion(coerced.purchasePrice, coerceNumber(coerced.purchasePrice, 0), 'purchasePrice');
  if (priceResult.changed) { log.push(priceResult.log!); coercionCount++; }
  coerced.purchasePrice = priceResult.value;
  
  const propResult = trackCoercion(coerced.personalPropertyIncluded, coerceStringArray(coerced.personalPropertyIncluded), 'personalPropertyIncluded');
  if (propResult.changed) { log.push(propResult.log!); coercionCount++; }
  coerced.personalPropertyIncluded = propResult.value;
  
  const effectiveResult = trackCoercion(coerced.effectiveDate, coerceString(coerced.effectiveDate), 'effectiveDate');
  if (effectiveResult.changed) { log.push(effectiveResult.log!); coercionCount++; }
  coerced.effectiveDate = effectiveResult.value;
  
  const escrowResult = trackCoercion(coerced.escrowHolder, coerceString(coerced.escrowHolder), 'escrowHolder');
  if (escrowResult.changed) { log.push(escrowResult.log!); coercionCount++; }
  coerced.escrowHolder = escrowResult.value;
  
  // === NESTED OBJECTS ===
  
  if (coerced.earnestMoneyDeposit != null) {
    const emd = coerced.earnestMoneyDeposit;
    coerced.earnestMoneyDeposit = {
      amount: coerceNumber(emd.amount),
      holder: coerceString(emd.holder),
    };
    if (JSON.stringify(emd) !== JSON.stringify(coerced.earnestMoneyDeposit)) {
      log.push(`🔧 earnestMoneyDeposit coerced`);
      coercionCount++;
    }
  }
  
  if (coerced.financing != null) {
    const fin = coerced.financing;
    coerced.financing = {
      isAllCash: coerceBoolean(fin.isAllCash),
      loanType: coerceString(fin.loanType),
      loanAmount: coerceNumber(fin.loanAmount),
    };
    if (JSON.stringify(fin) !== JSON.stringify(coerced.financing)) {
      log.push(`🔧 financing coerced`);
      coercionCount++;
    }
  }
  
  if (coerced.contingencies != null) {
    const cont = coerced.contingencies;
    coerced.contingencies = {
      inspectionDays: cont.inspectionDays, // Keep as-is (handled by normalizeDates)
      appraisalDays: cont.appraisalDays,
      loanDays: cont.loanDays,
      saleOfBuyerProperty: coerceBoolean(cont.saleOfBuyerProperty),
    };
  }
  
  if (coerced.closingCosts != null) {
    const costs = coerced.closingCosts;
    coerced.closingCosts = {
      buyerPays: coerceStringArray(costs.buyerPays),
      sellerPays: coerceStringArray(costs.sellerPays),
      sellerCreditAmount: coerceNumber(costs.sellerCreditAmount),
    };
    if (JSON.stringify(costs) !== JSON.stringify(coerced.closingCosts)) {
      log.push(`🔧 closingCosts coerced`);
      coercionCount++;
    }
  }
  
  if (coerced.brokers != null) {
    const brokers = coerced.brokers;
    coerced.brokers = {
      listingBrokerage: coerceString(brokers.listingBrokerage),
      listingAgent: coerceString(brokers.listingAgent),
      sellingBrokerage: coerceString(brokers.sellingBrokerage),
      sellingAgent: coerceString(brokers.sellingAgent),
    };
    if (JSON.stringify(brokers) !== JSON.stringify(coerced.brokers)) {
      log.push(`🔧 brokers coerced`);
      coercionCount++;
    }
  }
  
  console.log(`[coercion] ${coercionCount > 0 ? '⚠️' : '✅'} Applied ${coercionCount} type coercions`);
  console.log(`[coercion] ${"─".repeat(60)}\n`);
  
  return coerced;
}

// ============================================================================
// PAGE MERGING
// ============================================================================

function mergePages(
  pages: PerPageExtraction[],
  source: string,
  provenance: Record<string, number>,
  log: string[]
): Record<string, any> {
  const merged: Record<string, any> = {};
  
  for (const page of pages) {
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

function applyOverrides(
  baseline: Record<string, any>,
  overridePages: PerPageExtraction[],
  source: string,
  provenance: Record<string, number>,
  log: string[]
): Record<string, any> {
  const result = { ...baseline };
  
  for (const page of overridePages) {
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

// ============================================================================
// DATE NORMALIZATION (extraction-specific - could be moved to separate file)
// ============================================================================

function normalizeDates(
  terms: Record<string, any>,
  log: string[]
): Record<string, any> {
  const acceptanceDate = terms.effectiveDate;
  
  if (!acceptanceDate) {
    log.push('⚠️ No effective date found - cannot normalize relative dates');
    return terms;
  }
  
  if (terms.closingDate != null) {
    const normalized = normalizeSingleDate(terms.closingDate, acceptanceDate);
    if (normalized !== terms.closingDate) {
      log.push(`📅 closingDate normalized: ${terms.closingDate} → ${normalized}`);
      terms.closingDate = normalized;
    }
  }
  
  if (terms.contingencies) {
    const cont = terms.contingencies;
    ['inspectionDays', 'appraisalDays', 'loanDays'].forEach(field => {
      if (cont[field] != null) {
        const normalized = normalizeSingleDate(cont[field], acceptanceDate);
        if (normalized !== cont[field]) {
          log.push(`📅 ${field} normalized: ${cont[field]} → ${normalized}`);
          cont[field] = normalized;
        }
      }
    });
  }
  
  return terms;
}

function normalizeSingleDate(value: number | string, acceptanceDate: string): number | string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (typeof value === 'string' && isNaN(Number(value))) return value;
  
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
    if (current.getDay() !== 0 && current.getDay() !== 6) {
      added++;
    }
  }
  
  return current.toISOString().split('T')[0];
}

// ============================================================================
// VALIDATION (extraction-specific - could be moved to separate file)
// ============================================================================

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
  
  // Purchase price = 0
  if (terms.purchasePrice === 0) {
    errors.push('Purchase price is $0 (extraction failed)');
    needsSecondTurn = true;
    console.error(`[validator] ❌ Purchase price is $0`);
  }
  
  // Logic errors
  if (terms.purchasePrice > 0 && terms.earnestMoneyDeposit?.amount && 
      terms.purchasePrice < terms.earnestMoneyDeposit.amount) {
    errors.push(`Purchase price < earnest money`);
    needsReview = true;
  }
  
  if (terms.purchasePrice > 0 && terms.financing?.loanAmount &&
      terms.purchasePrice < terms.financing.loanAmount) {
    errors.push(`Purchase price < loan amount`);
    needsReview = true;
  }
  
  if (terms.financing?.isAllCash === true && terms.financing?.loanType) {
    warnings.push(`All cash but has loan type`);
    needsReview = true;
  }
  
  // Missing fields
  if (!terms.propertyAddress) {
    warnings.push('Property address missing');
    needsReview = true;
  }
  
  if (!terms.buyerNames || terms.buyerNames.length === 0) {
    warnings.push('No buyer names');
    needsReview = true;
  }
  
  if (!terms.closingDate) {
    warnings.push('Closing date missing');
  }
  
  console.log(`[validator] Errors: ${errors.length}, Warnings: ${warnings.length}`);
  console.log(`[validator] ${"═".repeat(60)}\n`);
  
  return { isValid: errors.length === 0, errors, warnings, needsReview, needsSecondTurn };
}