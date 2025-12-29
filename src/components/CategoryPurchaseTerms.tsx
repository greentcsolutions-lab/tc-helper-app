// src/components/CategoryPurchaseTerms.tsx
// Version: 2.0.0 - 2025-12-29
// FIXED: Proper null handling + zero-value detection (purchasePrice: 0 = error)
// ENHANCED: Type guards for all fields to prevent undefined/null display

import CategorySection from "./CategorySection";
import { DollarSign, AlertCircle } from "lucide-react";
import { ParseResult } from "@/types";

export default function CategoryPurchaseTerms({ data }: { data: ParseResult }) {
  // ═══════════════════════════════════════════════════════════════════════
  // HELPER: Safe array display
  // ═══════════════════════════════════════════════════════════════════════
  const formatNames = (names: string[] | null | undefined): string | null => {
    if (!Array.isArray(names) || names.length === 0) return null;
    return names.join(" & ");
  };

  // ═══════════════════════════════════════════════════════════════════════
  // HELPER: Safe currency display (zero = extraction error)
  // ═══════════════════════════════════════════════════════════════════════
  const formatCurrency = (
    amount: number | null | undefined,
    fieldName: string
  ): string | null => {
    if (typeof amount !== 'number') return null;
    
    // CRITICAL: purchasePrice: 0 means extraction failed
    if (fieldName === 'purchasePrice' && amount === 0) {
      return "⚠️ EXTRACTION ERROR (0)";
    }
    
    // Other zero values are valid (e.g., seller credit = $0)
    if (amount === 0) return "$0";
    
    return `$${amount.toLocaleString()}`;
  };

  // ═══════════════════════════════════════════════════════════════════════
  // HELPER: Safe boolean display
  // ═══════════════════════════════════════════════════════════════════════
  const formatBoolean = (value: boolean | null | undefined): string | null => {
    if (value === null || value === undefined) return null;
    return value ? "Yes" : "No";
  };

  // ═══════════════════════════════════════════════════════════════════════
  // HELPER: Safe date/string display
  // ═══════════════════════════════════════════════════════════════════════
  const formatString = (value: string | null | undefined): string | null => {
    if (typeof value !== 'string' || value.trim() === '') return null;
    return value;
  };

  // ═══════════════════════════════════════════════════════════════════════
  // BUILD FIELD LIST WITH TYPE-SAFE GUARDS
  // ═══════════════════════════════════════════════════════════════════════
  const fields = [
    {
      label: "Buyer Names",
      value: formatNames(data.buyerNames),
    },
    {
      label: "Seller Names",
      value: formatNames(data.sellerNames),
    },
    {
      label: "Property Address",
      value: formatString(data.propertyAddress),
    },
    {
      label: "Purchase Price",
      value: formatCurrency(data.purchasePrice, 'purchasePrice'),
    },
    {
      label: "All Cash Offer",
      value: formatBoolean(data.isAllCash),
    },
    {
      label: "Initial Deposit Amount",
      value: formatCurrency(data.earnestMoneyDeposit?.amount, 'earnestMoney'),
    },
    {
      label: "Deposit Holder",
      value: formatString(data.earnestMoneyDeposit?.holder),
    },
    {
      label: "Loan Type",
      value: formatString(data.loanType),
    },
    {
      label: "Close of Escrow",
      value: formatString(data.closingDate),
    },
    {
      label: "Effective Date",
      value: formatString(data.effectiveDate),
    },
    {
      label: "Seller Credit to Buyer",
      value: formatCurrency(data.closingCosts?.sellerCreditAmount, 'sellerCredit'),
    },
  ].filter((f) => f.value !== null);

  if (fields.length === 0) return null;

  // ═══════════════════════════════════════════════════════════════════════
  // CHECK FOR EXTRACTION ERRORS (purchasePrice = 0)
  // ═══════════════════════════════════════════════════════════════════════
  const hasExtractionError = data.purchasePrice === 0;

  return (
    <div className="space-y-3">
      {hasExtractionError && (
        <div className="p-4 rounded-lg border-2 border-orange-300 bg-orange-50 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-orange-900">
              Extraction Error Detected
            </p>
            <p className="text-xs text-orange-700 mt-1">
              Purchase price returned as $0, which indicates the extraction failed.
              This transaction requires manual review or re-extraction.
            </p>
          </div>
        </div>
      )}
      
      <CategorySection
        title="Purchase Terms & Costs"
        icon={<DollarSign className="h-6 w-6 text-green-600" />}
        fields={fields}
        categoryName="Purchase Terms"
        defaultOpen={true}
      />
    </div>
  );
}