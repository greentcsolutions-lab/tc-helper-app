// src/lib/parse/map-to-parse-result.ts
// Version: 3.1.0 - 2026-01-05
// FIXED: Maps new flat broker contact fields → nested listingAgentDetails / buyersAgentDetails
//         Added closeOfEscrowDate support

import type { UniversalExtractionResult } from '@/types/extraction';
import type { FieldProvenance } from '@/types/parse-result';

type MapToParseResultParams = {
  universal: UniversalExtractionResult;
  route: string;
  details?: {
    provenance?: Record<string, number>;
    pageExtractions?: Array<{
      pageNumber: number;
      pageLabel: string;
      confidence: { overall: number; fieldScores?: Record<string, number> };
      [key: string]: any;
    }>;
    confidenceBreakdown?: Record<string, number>;
    missingConfidenceFields?: string[];
    criticalPages?: string[]; // Page ranges for chunks with substantive data
    allExtractions?: any[];
  };
  timelineEvents?: any[];
};

function buildFieldProvenance(
  provenance: Record<string, number>,
  pageExtractions: Array<any>,
  finalTerms: UniversalExtractionResult
): FieldProvenance[] {
  return Object.entries(provenance).map(([field, pageNum]) => {
    const page = pageExtractions.find(p => p.pageNumber === pageNum);
    const fieldValue = field.includes('.') 
      ? getNestedValue(finalTerms, field)
      : (finalTerms as any)[field];
    
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

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

export function mapExtractionToParseResult({
  universal,
  route,
  details,
  timelineEvents = [],
}: MapToParseResultParams) {
  let fieldProvenance: FieldProvenance[] = [];
  
  if (details?.provenance && details?.pageExtractions) {
    fieldProvenance = buildFieldProvenance(
      details.provenance,
      details.pageExtractions,
      universal
    );
    console.log(`[map-to-parse-result] Built ${fieldProvenance.length} field provenance entries`);
  }

  // === BUILD NESTED BROKER DETAILS FROM FLAT FIELDS ===
  const brokers = universal.brokers;
  const listingAgentDetails = brokers ? {
    name: brokers.listingAgent || null,
    company: brokers.listingBrokerage || null,
    email: brokers.listingAgentEmail || null,
    phone: brokers.listingAgentPhone || null,
  } : null;

  const buyersAgentDetails = brokers ? {
    name: brokers.sellingAgent || null,
    company: brokers.sellingBrokerage || null,
    email: brokers.sellingAgentEmail || null,
    phone: brokers.sellingAgentPhone || null,
  } : null;

  return {
    // Core scalars
    buyerNames: (universal.buyerNames && universal.buyerNames.length > 0) ? universal.buyerNames : undefined,
    sellerNames: (universal.sellerNames && universal.sellerNames.length > 0) ? universal.sellerNames : undefined,
    propertyAddress: universal.propertyAddress || null,
    purchasePrice: universal.purchasePrice || null,
    earnestMoneyAmount: universal.earnestMoneyDeposit?.amount ?? null,
    earnestMoneyHolder: universal.earnestMoneyDeposit?.holder ?? null,
    closingDate: universal.closeOfEscrowDate || null, // ← Use calculated COE
    effectiveDate: universal.effectiveDate || null,
    initialDepositDueDate: universal.initialDepositDueDate || null,
    sellerDeliveryOfDisclosuresDate: universal.sellerDeliveryOfDisclosuresDate || null,

    isAllCash: universal.financing?.isAllCash ?? null,
    loanType: universal.financing?.loanType ?? null,

    // Full nested
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

    // === BROKERS: Map flat → nested structure expected by UI ===
    brokers: brokers
      ? {
          listingBrokerage: brokers.listingBrokerage,
          listingAgent: brokers.listingAgent,
          sellingBrokerage: brokers.sellingBrokerage,
          sellingAgent: brokers.sellingAgent,
          listingAgentDetails,
          buyersAgentDetails,
        }
      : null,

    personalPropertyIncluded: universal.personalPropertyIncluded ?? null,
    escrowHolder: universal.escrowHolder ?? null,

    // Rich data
    extractionDetails: { 
      route,
      fieldProvenance,
      confidenceBreakdown: details?.confidenceBreakdown || {},
      missingConfidenceFields: details?.missingConfidenceFields || [],
    },

    ...(timelineEvents.length > 0 ? { timelineEvents } : {}),
  };
}