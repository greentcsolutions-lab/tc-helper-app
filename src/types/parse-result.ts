// src/types/parse-result.ts
// Version: 3.1.0 - 2026-01-29
// ENHANCED: Added AllocationItem type for closing cost allocations table
// BREAKING: purchasePrice: 0 is now treated as an extraction error

import { JsonValue } from "@prisma/client/runtime/library";

// ═══════════════════════════════════════════════════════════════════════════
// NEW: Closing Cost Allocation Item Type
// ═══════════════════════════════════════════════════════════════════════════
export interface AllocationItem {
  itemName: string;
  paidBy: "Buyer" | "Seller" | "Split";
  amount: number | null;
  notes: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Field provenance tracking (Issue 6)
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

  // === UNIVERSAL CORE FIELDS (existing scalars preserved) ===
  transactionType: string | null;           // "listing" or "escrow"
  buyerNames: string[] | null;
  sellerNames: string[] | null;
  propertyAddress: string | null;
  purchasePrice: number | null;  // IMPORTANT: 0 = extraction error, requires review
  earnestMoneyAmount: number | null;        // deprecated — use earnestMoneyDeposit.amount
  earnestMoneyHolder: string | null;        // deprecated — use earnestMoneyDeposit.holder
  closingDate: string | null;
  effectiveDate: string | null;             // Acceptance date (YYYY-MM-DD)
  initialDepositDueDate: string | null;     // Earnest money due date (YYYY-MM-DD or "N days")
  sellerDeliveryOfDisclosuresDate: string | null; // YYYY-MM-DD or "N days"
  isAllCash: boolean | null;
  loanType: string | null;

  // === NEW: FULL NESTED UNIVERSAL FIELDS ===
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
    inspectionDays: number | string | null;     // number of days or "Waived"
    appraisalDays: number | string | null;
    loanDays: number | string | null;
    saleOfBuyerProperty: boolean;
  } | null;

  closingCosts: {
    buyerPays: string[];
    sellerPays: string[];
    sellerCreditAmount: number | null;
    allocations?: AllocationItem[]; // NEW: Detailed closing cost allocations for table display
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

  // === RICH JSON FIELDS (enhanced with field provenance) ===
  extractionDetails?: ExtractionDetails | JsonValue | null;

  timelineEvents?: JsonValue | null;

  timelineDataStructured?: JsonValue | null;  // Structured timeline data with calculation metadata

  // === THUMBNAILS / PREVIEWS ===
  lowResZipUrl?: string | null;
  criticalPageNumbers?: number[] | null;
}
