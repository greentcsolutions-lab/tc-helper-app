// src/lib/parse/map-to-parse-result.ts
// Version: 2.0.0 - 2025-12-29
// ENHANCED: Now includes field provenance in extractionDetails
// Maps UniversalExtractionResult → enriched ParseResult fields for DB update

import type { UniversalExtractionResult } from '@/types/extraction';

type FieldProvenance = {
  field: string;
  pageNumber: number;
  pageLabel: string;
  confidence: number;
  value: any;
};

type MapToParseResultParams = {
  universal: UniversalExtractionResult;
  route: string;
  details?: {
    fieldProvenance?: FieldProvenance[];
    confidenceBreakdown?: Record<string, number>;
    missingConfidenceFields?: string[];
  };
  timelineEvents?: any[];
};

export function mapExtractionToParseResult({
  universal,
  route,
  details,
  timelineEvents = [],
}: MapToParseResultParams) {
  return {
    // === UNIVERSAL CORE SCALARS (backward compat) ===
    buyerNames: universal.buyerNames.length > 0 ? universal.buyerNames : undefined,
    sellerNames: universal.sellerNames.length > 0 ? universal.sellerNames : undefined,
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

    // === RICH DATA (now includes field provenance) ===
    extractionDetails: details 
      ? { 
          route, 
          fieldProvenance: details.fieldProvenance || [],
          confidenceBreakdown: details.confidenceBreakdown || {},
          missingConfidenceFields: details.missingConfidenceFields || [],
        } 
      : { route },

    // === TIMELINE ===
    ...(timelineEvents.length > 0 ? { timelineEvents } : {}),
  };
}