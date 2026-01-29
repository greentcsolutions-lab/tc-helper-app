// src/types/parse-result.ts
// Version: 4.0.0 - 2026-01-29
// ENHANCED: Added closing cost allocation types to ParseResult
//           Field provenance tracking for debugging
//           extractionDetails includes fieldProvenance, confidenceBreakdown, missingConfidenceFields

import { JsonValue } from "@prisma/client/runtime/library";

// ═══════════════════════════════════════════════════════════════════════════
// Closing Cost Allocation Types
// ═══════════════════════════════════════════════════════════════════════════
export interface ClosingCostItem {
  itemName: string;           // Exact name as it appears in contract
  paidBy: "Buyer" | "Seller" | "Split" | "Buyer and Seller" | "Waived" | "Not specified";
  amount: number | null;      // Dollar amount if specified
  notes: string | null;       // Additional context
}

// ═══════════════════════════════════════════════════════════════════════════
// Field Provenance Tracking
// ═══════════════════════════════════════════════════════════════════════════
export interface FieldProvenance {
  field: string;            // e.g., "purchasePrice", "buyerNames", "brokers.listingAgent"
  pageNumber: number;       // Which PDF page this field came from
  pageLabel: string;        // Human-readable label (e.g., "RPA PAGE 1 - TERMS")
  confidence: number;       // 0-100 confidence for this specific field
  value: any;               // The extracted value
}

export interface ExtractionDetails {
  route: "universal" | "california" | "california-fallback-universal";
  
  // Field provenance (which page → which field)
  fieldProvenance?: FieldProvenance[];
  
  // Per-field confidence scores
  confidenceBreakdown?: Record<string, number>;
  
  // Fields that didn't return confidence scores
  missingConfidenceFields?: string[];
  
  // Legacy/future state-specific data
  [key: string]: any;
}

export interface ParseResult {
  // === CORE IDENTIFIERS & METADATA ===
  id: string;
  fileName: string;
  status: string;
  createdAt: string | Date;
  finalizedAt: string | Date | null;

  // === UNIVERSAL CORE FIELDS ===
  transactionType: string | null;
  buyerNames: string[] | null;
  sellerNames: string[] | null;
  propertyAddress: string | null;
  purchasePrice: number | null;
  earnestMoneyAmount: number | null;        // deprecated — use earnestMoneyDeposit.amount
  earnestMoneyHolder: string | null;        // deprecated — use earnestMoneyDeposit.holder
  closingDate: string | null;
  effectiveDate: string | null;
  initialDepositDueDate: string | null;
  sellerDeliveryOfDisclosuresDate: string | null;
  isAllCash: boolean | null;
  loanType: string | null;

  // === NESTED UNIVERSAL FIELDS ===
  earnestMoneyDeposit: {
    amount: number | null;
    holder: string | null;
  } | null;

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

  // ENHANCED: Closing costs with detailed allocations
  closingCosts: {
    allocations: ClosingCostItem[];           // NEW: Detailed allocations
    sellerCreditAmount: number | null;        // Auto-extracted from allocations
    buyerPays: string[];                      // DEPRECATED: Keep for backward compatibility
    sellerPays: string[];                     // DEPRECATED: Keep for backward compatibility
  } | null;

  brokers: {
    // Legacy fields (for backwards compatibility with AI extraction)
    listingBrokerage?: string | null;
    listingAgent?: string | null;
    sellingBrokerage?: string | null;
    sellingAgent?: string | null;

    // New detailed agent fields (for manual entry)
    listingAgentDetails?: {
      name: string | null;
      company: string | null;
      phone: string | null;
      email: string | null;
    } | null;
    buyersAgentDetails?: {
      name: string | null;
      company: string | null;
      phone: string | null;
      email: string | null;
    } | null;
  } | null;

  personalPropertyIncluded: string[] | null;
  escrowHolder: string | null;

  // === FLAGS ===
  missingSCOs: boolean;

  // === RICH JSON FIELDS ===
  extractionDetails?: ExtractionDetails | JsonValue | null;
  timelineEvents?: JsonValue | null;
  timelineDataStructured?: JsonValue | null;

  // === THUMBNAILS / PREVIEWS ===
  lowResZipUrl?: string | null;
  criticalPageNumbers?: number[] | null;
}
