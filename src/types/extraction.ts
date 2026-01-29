// src/types/extraction.ts
// Version: 4.0.0 - 2026-01-29
// ENHANCED: Added detailed closing cost allocation types with flexible naming
//           Full broker contact info (email/phone)
//           Added closeOfEscrowDate and contingency deadlines

/**
 * Individual closing cost allocation item
 */
export interface ClosingCostItem {
  itemName: string;           // Exact name as it appears in contract
  paidBy: "Buyer" | "Seller" | "Split" | "Buyer and Seller" | "Waived" | "Not specified";
  amount: number | null;      // Dollar amount if specified
  notes: string | null;       // Additional context (e.g., "split 50/50", "up to $500")
}

/**
 * Per-page extraction result from AI (pure OCR extraction)
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
  closing?: {
    daysAfterAcceptance?: number | null;
    specificDate?: string | null; // YYYY-MM-DD
  } | null;
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
    allocations: ClosingCostItem[];           // NEW: Detailed allocations
    sellerCreditAmount: number | null;        // DEPRECATED: Use allocations instead
    buyerPays: string[] | null;               // DEPRECATED: Use allocations instead
    sellerPays: string[] | null;              // DEPRECATED: Use allocations instead
  } | null;
  brokers?: {
    listingBrokerage: string | null;
    listingAgent: string | null;
    listingAgentEmail: string | null;
    listingAgentPhone: string | null;
    sellingBrokerage: string | null;
    sellingAgent: string | null;
    sellingAgentEmail: string | null;
    sellingAgentPhone: string | null;
  } | null;
  personalPropertyIncluded?: string[] | null;
  buyerSignatureDates?: string[] | null;
  sellerSignatureDates?: string[] | null;
  escrowHolder?: string | null;
  additionalTerms?: string[] | null;
  confidence: {
    overall: number;
    fieldScores?: Record<string, number>;
    sources?: Record<string, string>;
  };
}

/**
 * Enriched per-page extraction WITH classification metadata
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
  effectiveDate: string | null;
  closeOfEscrowDate: string | null;
  initialDepositDueDate?: string | null;
  sellerDeliveryOfDisclosuresDate?: string | null;
  closing?: {
    daysAfterAcceptance?: number | null;
    specificDate?: string | null;
  } | null;
  financing: {
    isAllCash: boolean | null;
    loanType: "Conventional" | "FHA" | "VA" | "USDA" | "Other" | null;
    loanAmount: number | null;
  } | null;
  contingencies: {
    inspectionDays: number | string | null;
    inspectionDaysDeadline?: string | null;
    appraisalDays: number | string | null;
    appraisalDaysDeadline?: string | null;
    loanDays: number | string | null;
    loanDaysDeadline?: string | null;
    saleOfBuyerProperty: boolean | null;
  } | null;
  closingCosts: {
    allocations: ClosingCostItem[];           // NEW: Detailed allocations
    sellerCreditAmount: number | null;        // DEPRECATED: Keep for backward compatibility
    buyerPays: string[] | null;               // DEPRECATED: Keep for backward compatibility
    sellerPays: string[] | null;              // DEPRECATED: Keep for backward compatibility
  } | null;
  brokers: {
    listingBrokerage: string | null;
    listingAgent: string | null;
    listingAgentEmail: string | null;
    listingAgentPhone: string | null;
    sellingBrokerage: string | null;
    sellingAgent: string | null;
    sellingAgentEmail: string | null;
    sellingAgentPhone: string | null;
  } | null;
  personalPropertyIncluded: string[] | null;
  escrowHolder: string | null;
  additionalTerms: string[] | null;
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
