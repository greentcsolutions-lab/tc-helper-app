// src/lib/parse/map-to-parse-result.ts 
// Version: 3.0.1 - 2025-12-29
// FIX: Added defensive null checks for buyerNames/sellerNames to prevent .length on undefined

import type { UniversalExtractionResult } from '@/types/extraction';
import type { FieldProvenance } from '@/types/parse-result';

type MapToParseResultParams = {
  universal: UniversalExtractionResult;
  route: string;
  details?: {
    provenance?: Record<string, number>;  // field → pageNumber
    pageExtractions?: Array<{
      pageNumber: number;
      pageLabel: string;
      confidence: { overall: number; fieldScores?: Record<string, number> };
      [key: string]: any;
    }>;
    confidenceBreakdown?: Record<string, number>;
    missingConfidenceFields?: string[];
  };
  timelineEvents?: any[];
};

/**
 * Builds proper FieldProvenance array from provenance map
 * FIX #2: Converts Record<string, number> → FieldProvenance[]
 */
function buildFieldProvenance(
  provenance: Record<string, number>,
  pageExtractions: Array<any>,
  finalTerms: UniversalExtractionResult
): FieldProvenance[] {
  return Object.entries(provenance).map(([field, pageNum]) => {
    const page = pageExtractions.find(p => p.pageNumber === pageNum);
    
    // Get nested field value (handles "brokers.listingAgent" notation)
    const fieldValue = field.includes('.') 
      ? getNestedValue(finalTerms, field)
      : (finalTerms as any)[field];
    
    // Get confidence from field scores or page overall
    const confidence = page?.confidence?.fieldScores?.[field] 
      || page?.confidence?.overall 
      || 0;
    
    return {
      field,
      pageNumber: pageNum,
      pageLabel: page?.pageLabel || `Page ${pageNum}`,
      confidence,
      value: fieldValue,
    };
  });
}

/**
 * Helper: Get nested value from object (e.g., "brokers.listingAgent")
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

export function mapExtractionToParseResult({
  universal,
  route,
  details,
  timelineEvents = [],
}: MapToParseResultParams) {
  // Build field provenance if we have the data (FIX #2)
  let fieldProvenance: FieldProvenance[] = [];
  
  if (details?.provenance && details?.pageExtractions) {
    fieldProvenance = buildFieldProvenance(
      details.provenance,
      details.pageExtractions,
      universal
    );
    
    console.log(`[map-to-parse-result] Built ${fieldProvenance.length} field provenance entries`);
  }
  
  return {
    // === UNIVERSAL CORE SCALARS (backward compat) ===
    // FIX: Added defensive null/undefined checks before accessing .length
    buyerNames: (universal.buyerNames && universal.buyerNames.length > 0) ? universal.buyerNames : undefined,
    sellerNames: (universal.sellerNames && universal.sellerNames.length > 0) ? universal.sellerNames : undefined,
    propertyAddress: universal.propertyAddress || null,
    purchasePrice: universal.purchasePrice || null,
    earnestMoneyAmount: universal.earnestMoneyDeposit?.amount ?? null,
    earnestMoneyHolder: universal.earnestMoneyDeposit?.holder ?? null,
    closingDate:
      universal.closingDate == null
        ? null
        : typeof universal.closingDate === 'string'
          ? universal.closingDate
          : null,
    effectiveDate: universal.effectiveDate || null,
    isAllCash: universal.financing?.isAllCash ?? null,
    loanType: universal.financing?.loanType ?? null,

    // === FULL NESTED FIELDS ===
    earnestMoneyDeposit: universal.earnestMoneyDeposit
      ? {
          amount: universal.earnestMoneyDeposit.amount,
          holder: universal.earnestMoneyDeposit.holder,
        }
      : null,

    financing: universal.financing
      ? {
          isAllCash: universal.financing.isAllCash,
          loanType: universal.financing.loanType,
          loanAmount: universal.financing.loanAmount,
        }
      : null,

    contingencies: universal.contingencies
      ? {
          inspectionDays: universal.contingencies.inspectionDays,
          appraisalDays: universal.contingencies.appraisalDays,
          loanDays: universal.contingencies.loanDays,
          saleOfBuyerProperty: universal.contingencies.saleOfBuyerProperty,
        }
      : null,

    closingCosts: universal.closingCosts
      ? {
          buyerPays: universal.closingCosts.buyerPays ?? [],
          sellerPays: universal.closingCosts.sellerPays ?? [],
          sellerCreditAmount: universal.closingCosts.sellerCreditAmount,
        }
      : null,

    brokers: universal.brokers
      ? {
          listingBrokerage: universal.brokers.listingBrokerage,
          listingAgent: universal.brokers.listingAgent,
          sellingBrokerage: universal.brokers.sellingBrokerage,
          sellingAgent: universal.brokers.sellingAgent,
        }
      : null,

    personalPropertyIncluded: universal.personalPropertyIncluded ?? null,
    escrowHolder: universal.escrowHolder ?? null,

    // === RICH DATA (FIX #2: now includes field provenance) ===
    extractionDetails: { 
      route,
      fieldProvenance,  // ← NOW PROPERLY POPULATED!
      confidenceBreakdown: details?.confidenceBreakdown || {},
      missingConfidenceFields: details?.missingConfidenceFields || [],
    },

    // === TIMELINE ===
    ...(timelineEvents.length > 0 ? { timelineEvents } : {}),
  };
}