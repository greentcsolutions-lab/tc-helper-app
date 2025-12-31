// TC Helper App
// src/types/extraction.ts
// Version: 2.0.0 - 2025-12-31
// FIXED: Removed 'signatures' from pageRole - signature sections are part of their parent documents

/**
 * Per-page extraction result from Grok (pure OCR extraction)
 * No classification metadata - just raw field extraction
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
  closingDate?: string | null;
  financing?: {
    isAllCash: boolean | null;
    loanType: string | null;
    loanAmount: number | null;
  } | null;
  contingencies?: {
    inspectionDays: number | string | null;
    appraisalDays: number | string | null;
    loanDays: number | string | null;
    saleOfBuyerProperty: boolean;
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
 * 
 * IMPORTANT: 'signatures' role removed - signature sections are always part of their parent document:
 * - RPA signature pages → 'main_contract'
 * - Counter offer signature pages → 'counter_offer'
 * - Addendum signature pages → 'addendum'
 */
export interface EnrichedPageExtraction extends PerPageExtraction {
  pageNumber: number;
  pageLabel: string;
  formCode: string;
  formPage: number | null;
  pageRole: 'main_contract' | 'counter_offer' | 'addendum' | 'broker_info';
}

/**
 * Final merged result across all critical pages
 */
export interface UniversalExtractionResult {
  buyerNames: string[] | null;
  sellerNames: string[] | null;
  propertyAddress: string | null;
  purchasePrice: number | null;
  earnestMoneyDeposit: {
    amount: number | null;
    holder: string | null;
  } | null;
  closingDate: string | null;
  effectiveDate: string | null;
  financing: {
    isAllCash: boolean;
    loanType: "Conventional" | "FHA" | "VA" | "USDA" | "Other" | null;
    loanAmount: number | null;
  } | null;
  contingencies: {
    inspectionDays: number | string | null;
    appraisalDays: number | string | null;
    loanDays: number | string | null;
    saleOfBuyerProperty: boolean;
  } | null;
  closingCosts: {
    buyerPays: string[];
    sellerPays: string[];
    sellerCreditAmount: number | null;
  } | null;
  brokers: {
    listingBrokerage: string | null;
    listingAgent: string | null;
    sellingBrokerage: string | null;
    sellingAgent: string | null;
  } | null;
  personalPropertyIncluded: string[] | null;
  escrowHolder: string | null;
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