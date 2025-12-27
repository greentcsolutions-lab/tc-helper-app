// src/types/parse-result.ts
// Version: 2.0.0 - 2025-12-24
// SINGLE SOURCE OF TRUTH FOR ALL PARSE RESULTS TYPES
// Public ParseResult contract — enriched with full universal extraction fields
// Preserves all existing fields for backward compatibility during migration

import { JsonValue } from "@prisma/client/runtime/library";

export interface ParseResult {
  // === CORE IDENTIFIERS & METADATA ===
  id: string;
  fileName: string;
  status: string;
  createdAt: string | Date;
  finalizedAt: string | Date | null;

  // === UNIVERSAL CORE FIELDS (existing scalars preserved) ===
  buyerNames: string[] | null;
  sellerNames: string[] | null;
  propertyAddress: string | null;
  purchasePrice: number | null;
  earnestMoneyAmount: number | null;        // deprecated — use earnestMoneyDeposit.amount
  earnestMoneyHolder: string | null;        // deprecated — use earnestMoneyDeposit.holder
  closingDate: string | null;
  effectiveDate: string | null;
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
  } | null;

  brokers: {
    listingBrokerage: string | null;
    listingAgent: string | null;
    sellingBrokerage: string | null;
    sellingAgent: string | null;
  } | null;

  personalPropertyIncluded: string[] | null;

  escrowHolder: string | null;

  // === FLAGS ===
  missingSCOs: boolean;

  // === RICH JSON FIELDS (kept for backward compatibility with old records) ===
  extractionDetails?: {
    route?: "universal" | "california" | "california-fallback-universal";
    [key: string]: any;
  } | JsonValue | null;

  timelineEvents?: JsonValue | null;

  // === THUMBNAILS / PREVIEWS ===
  lowResZipUrl?: string | null;
  criticalPageNumbers?: number[] | null;
}