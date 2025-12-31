// src/types/extraction.ts
// Version: 3.0.0 - 2025-12-31
// UPDATED: Added PerPageExtraction and EnrichedPageExtraction types

export interface UniversalExtractionResult {
  buyerNames: string[];
  sellerNames: string[];
  propertyAddress: string;
  purchasePrice: number;
  earnestMoneyDeposit: {
    amount: number | null;
    holder: string | null;
  };
  closingDate: string | number | null;
  financing: {
    isAllCash: boolean;
    loanType: "Conventional" | "FHA" | "VA" | "USDA" | "Other" | null;
    loanAmount: number | null;
  };
  contingencies: {
    inspectionDays: number | string | null;
    appraisalDays: number | string | null;
    loanDays: number | string | null;
    saleOfBuyerProperty: boolean;
  };
  closingCosts: {
    buyerPays: string[];
    sellerPays: string[];
    sellerCreditAmount: number | null;
  };
  brokers: {
    listingBrokerage: string | null;
    listingAgent: string | null;
    sellingBrokerage: string | null;
    sellingAgent: string | null;
  };
  personalPropertyIncluded: string[];
  effectiveDate: string | null;
  escrowHolder: string | null;
}

/**
 * Per-page extraction result (LEAN - no classification metadata)
 * This is what Grok returns for each page
 */
export interface PerPageExtraction {
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
  buyerSignatureDates?: string[] | null;
  sellerSignatureDates?: string[] | null;
  escrowHolder?: string | null;
  confidence: {
    overall: number;
    fieldScores?: Record<string, number>;
  };
}

/**
 * Enriched per-page extraction WITH classification metadata
 * Internal use only - combines Grok extraction with classification cache
 */
export interface EnrichedPageExtraction extends PerPageExtraction {
  pageNumber: number;
  pageLabel: string;
  formCode: string;
  formPage: number | null;
  pageRole: 'main_contract' | 'counter_offer' | 'addendum' | 'signatures' | 'broker_info';
}

/**
 * Result of merging all pages together
 */
export interface MergeResult {
  finalTerms: UniversalExtractionResult;
  provenance: Record<string, number>;
  pageExtractions: EnrichedPageExtraction[];
  needsReview: boolean;
  needsSecondTurn: boolean;
  mergeLog: string[];
  validationErrors: string[];
  validationWarnings: string[];
}