// src/components/CategoryPurchaseTerms.tsx
// Version: 4.0.0 - 2026-01-29
// ENHANCED: Added closing cost allocation table display
//           Edit mode support for all fields
//           Proper null handling + zero-value detection

import CategorySection, { FieldConfig } from "./CategorySection";
import { DollarSign, AlertCircle } from "lucide-react";
import { ParseResult } from "@/types";
import { formatDisplayDate } from "@/lib/date-utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

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
      "Escrow Holder",
      isEditing ? data.escrowHolder : formatString(data.escrowHolder),
      'text',
      (val) => onDataChange?.({ ...data, escrowHolder: val })
    ),
    createField(
      "Contingent on Sale of Buyer's Property?",
      isEditing ? data.contingencies?.saleOfBuyerProperty : formatBoolean(data.contingencies?.saleOfBuyerProperty),
      'boolean',
      (val) => onDataChange?.({
        ...data,
        contingencies: { ...data.contingencies, saleOfBuyerProperty: val },
      })
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

  // ═══════════════════════════════════════════════════════════════════════
  // CHECK FOR EXTRACTION ERRORS (purchasePrice = 0)
  // ═══════════════════════════════════════════════════════════════════════
  const hasExtractionError = data.purchasePrice === 0;

  // ═══════════════════════════════════════════════════════════════════════
  // CLOSING COST ALLOCATIONS TABLE
  // ═══════════════════════════════════════════════════════════════════════
  const closingCostAllocations = data.closingCosts?.allocations || [];
  const hasClosingCosts = closingCostAllocations.length > 0;

  // Helper to get badge color based on who pays
  const getPaidByColor = (paidBy: string) => {
    switch (paidBy) {
      case 'Buyer':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300';
      case 'Seller':
        return 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300';
      case 'Split':
      case 'Buyer and Seller':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300';
      case 'Waived':
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
      default:
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300';
    }
  };

  return (
    <div className="space-y-6">
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

      {/* NEW: Closing Cost Allocations Table */}
      {hasClosingCosts && !isEditing && (
        <div className="mt-6">
          <div className="bg-muted/50 rounded-t-lg px-5 py-3 border-x border-t border-border/50">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Allocation of Closing Costs
              <Badge variant="secondary" className="font-mono text-[10px] px-1.5 py-0">
                {closingCostAllocations.length} ITEMS
              </Badge>
            </h3>
          </div>
          <div className="border border-border/50 rounded-b-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="font-semibold">Cost Item</TableHead>
                  <TableHead className="font-semibold">Paid By</TableHead>
                  <TableHead className="font-semibold text-right">Amount</TableHead>
                  <TableHead className="font-semibold">Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {closingCostAllocations.map((item, index) => (
                  <TableRow key={index} className="hover:bg-muted/50">
                    <TableCell className="font-medium">
                      {item.itemName}
                    </TableCell>
                    <TableCell>
                      <Badge className={getPaidByColor(item.paidBy)}>
                        {item.paidBy}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {item.amount !== null 
                        ? `$${item.amount.toLocaleString()}` 
                        : <span className="text-muted-foreground text-xs">Not specified</span>
                      }
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.notes || '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Show total seller credit if present */}
          {data.closingCosts?.sellerCreditAmount !== null && (
            <div className="mt-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-green-900 dark:text-green-100">
                  Total Seller Credit to Buyer
                </span>
                <span className="text-lg font-bold text-green-700 dark:text-green-300">
                  ${data.closingCosts.sellerCreditAmount.toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
