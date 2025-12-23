// src/lib/extraction/extract/universal/types.ts
// Version: 1.0.0 - 2025-12-23
// Universal extraction result types for real estate offers

export interface UniversalExtractionResult {
  buyerNames: string[];
  sellerNames: string[];
  propertyAddress: string;
  purchasePrice: number;
  earnestMoneyDeposit: {
    amount: number | null;
    holder: string | null;
  };
  closingDate: string | number | null; // string = YYYY-MM-DD, number = days
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
  effectiveDate: string | null; // YYYY-MM-DD
  escrowHolder: string | null;
}