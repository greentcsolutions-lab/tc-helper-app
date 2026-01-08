// src/components/CategoryPurchaseTerms.tsx
// Version: 3.1.0 - 2026-01-08
// ENHANCED: Added edit mode support and missing fields (loan amount, personal property, escrow holder, closing costs)
// FIXED: Proper null handling + zero-value detection (purchasePrice: 0 = error)
// FIXED: Date formatting - displays dates as MM/DD/YYYY to users

import CategorySection, { FieldConfig } from "./CategorySection";
import { DollarSign, AlertCircle } from "lucide-react";
import { ParseResult } from "@/types";
import { formatDisplayDate } from "@/lib/date-utils";

interface CategoryPurchaseTermsProps {
  data: ParseResult;
  isEditing?: boolean;
  onDataChange?: (updatedData: ParseResult) => void;
}

export default function CategoryPurchaseTerms({
  data,
  isEditing = false,
  onDataChange,
}: CategoryPurchaseTermsProps) {
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
  // HELPER: Format date for display (YYYY-MM-DD → MM/DD/YYYY)
  // ═══════════════════════════════════════════════════════════════════════
  const formatDate = (value: string | null | undefined): string | null => {
    if (typeof value !== 'string' || value.trim() === '') return null;
    try {
      return formatDisplayDate(value);
    } catch (e) {
      // If parsing fails, return the original value
      return value;
    }
  };

  // ═══════════════════════════════════════════════════════════════════════
  // HELPER: Format array for display
  // ═══════════════════════════════════════════════════════════════════════
  const formatArray = (arr: string[] | null | undefined): string | null => {
    if (!Array.isArray(arr) || arr.length === 0) return null;
    return arr.join(', ');
  };

  // ═══════════════════════════════════════════════════════════════════════
  // BUILD FIELD LIST WITH TYPE-SAFE GUARDS AND EDIT SUPPORT
  // ═══════════════════════════════════════════════════════════════════════
  const createField = (
    label: string,
    value: any,
    type?: 'text' | 'number' | 'date' | 'boolean' | 'array',
    onChange?: (val: any) => void
  ): FieldConfig => ({
    label,
    value,
    type,
    onChange,
  });

  const allFields: FieldConfig[] = [
    createField(
      "Buyer Names",
      isEditing ? data.buyerNames : formatNames(data.buyerNames),
      'array',
      (val) => onDataChange?.({ ...data, buyerNames: val })
    ),
    createField(
      "Seller Names",
      isEditing ? data.sellerNames : formatNames(data.sellerNames),
      'array',
      (val) => onDataChange?.({ ...data, sellerNames: val })
    ),
    createField(
      "Property Address",
      isEditing ? data.propertyAddress : formatString(data.propertyAddress),
      'text',
      (val) => onDataChange?.({ ...data, propertyAddress: val })
    ),
    createField(
      "Purchase Price",
      isEditing ? data.purchasePrice : formatCurrency(data.purchasePrice, 'purchasePrice'),
      'number',
      (val) => onDataChange?.({ ...data, purchasePrice: val })
    ),
    createField(
      "All Cash Offer",
      isEditing ? data.isAllCash : formatBoolean(data.isAllCash),
      'boolean',
      (val) => onDataChange?.({ ...data, isAllCash: val })
    ),
    createField(
      "Initial Deposit Amount",
      isEditing ? data.earnestMoneyDeposit?.amount : formatCurrency(data.earnestMoneyDeposit?.amount, 'earnestMoney'),
      'number',
      (val) => onDataChange?.({
        ...data,
        earnestMoneyDeposit: { ...data.earnestMoneyDeposit, amount: val },
      })
    ),
    createField(
      "Deposit Holder",
      isEditing ? data.earnestMoneyDeposit?.holder : formatString(data.earnestMoneyDeposit?.holder),
      'text',
      (val) => onDataChange?.({
        ...data,
        earnestMoneyDeposit: { ...data.earnestMoneyDeposit, holder: val },
      })
    ),
    createField(
      "Loan Type",
      isEditing ? data.loanType : formatString(data.loanType),
      'text',
      (val) => onDataChange?.({ ...data, loanType: val })
    ),
    createField(
      "Loan Amount",
      isEditing ? data.financing?.loanAmount : formatCurrency(data.financing?.loanAmount, 'loanAmount'),
      'number',
      (val) => onDataChange?.({
        ...data,
        financing: { ...data.financing, loanAmount: val },
      })
    ),
    createField(
      "Close of Escrow",
      isEditing ? data.closingDate : formatDate(data.closingDate),
      'date',
      (val) => onDataChange?.({ ...data, closingDate: val })
    ),
    createField(
      "Effective Date",
      isEditing ? data.effectiveDate : formatDate(data.effectiveDate),
      'date',
      (val) => onDataChange?.({ ...data, effectiveDate: val })
    ),
    createField(
      "Seller Credit to Buyer",
      isEditing ? data.closingCosts?.sellerCreditAmount : formatCurrency(data.closingCosts?.sellerCreditAmount, 'sellerCredit'),
      'number',
      (val) => onDataChange?.({
        ...data,
        closingCosts: { ...data.closingCosts, sellerCreditAmount: val },
      })
    ),
    createField(
      "Escrow Holder",
      isEditing ? data.escrowHolder : formatString(data.escrowHolder),
      'text',
      (val) => onDataChange?.({ ...data, escrowHolder: val })
    ),
    createField(
      "Personal Property Included",
      isEditing ? data.personalPropertyIncluded : formatArray(data.personalPropertyIncluded),
      'array',
      (val) => onDataChange?.({ ...data, personalPropertyIncluded: val })
    ),
  ];

  // Filter out null values when not editing
  const fields = isEditing ? allFields : allFields.filter((f) => f.value !== null);

  if (fields.length === 0) return null;

  // ═══════════════════════════════════════════════════════════════════════
  // CHECK FOR EXTRACTION ERRORS (purchasePrice = 0)
  // ═══════════════════════════════════════════════════════════════════════
  const hasExtractionError = data.purchasePrice === 0;

  return (
    <div className="space-y-3">
      {hasExtractionError && !isEditing && (
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
        isEditing={isEditing}
      />
    </div>
  );
}
