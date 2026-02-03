// src/components/CategoryPurchaseTerms.tsx
// Version: 4.0.0 - 2026-01-29
// ENHANCED: Added Allocation of Closing Costs table with full CRUD support
// ENHANCED: Separate "Copy All" buttons for main fields and allocations table
// ENHANCED: Individual copy buttons for each allocation row

import { useState } from "react";
import CategorySection, { FieldConfig } from "./CategorySection";
import { DollarSign, AlertCircle, Copy, Plus, Trash2 } from "lucide-react";
import { ParseResult } from "@/types";
import { formatDisplayDate } from "@/lib/date-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface CategoryPurchaseTermsProps {
  data: ParseResult;
  isEditing?: boolean;
  onDataChange?: (updatedData: ParseResult) => void;
}

// Type for closing cost allocation items (matches database structure)
export interface AllocationItem {
  itemName: string;
  paidBy: "Buyer" | "Seller" | "Split";
  amount: number | null;
  notes: string | null;
}

export default function CategoryPurchaseTerms({
  data,
  isEditing = false,
  onDataChange,
}: CategoryPurchaseTermsProps) {
  // Local state for editing allocations
  const [allocations, setAllocations] = useState<AllocationItem[]>(
    data.closingCosts?.allocations || []
  );

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
  // ALLOCATION TABLE HANDLERS
  // ═══════════════════════════════════════════════════════════════════════

  const handleAddAllocation = () => {
    const newAllocation: AllocationItem = {
      itemName: "",
      paidBy: "Buyer",
      amount: null,
      notes: null,
    };
    const updated = [...allocations, newAllocation];
    setAllocations(updated);
    updateClosingCosts(updated);
  };

  const handleRemoveAllocation = (index: number) => {
    const updated = allocations.filter((_, i) => i !== index);
    setAllocations(updated);
    updateClosingCosts(updated);
  };

  const handleUpdateAllocation = (
    index: number,
    field: keyof AllocationItem,
    value: any
  ) => {
    const updated = [...allocations];
    updated[index] = { ...updated[index], [field]: value };
    setAllocations(updated);
    updateClosingCosts(updated);
  };

  const updateClosingCosts = (updatedAllocations: AllocationItem[]) => {
    if (!onDataChange) return;
    onDataChange({
      ...data,
      closingCosts: {
        ...data.closingCosts,
        allocations: updatedAllocations,
      },
    });
  };

  const copyAllocationRow = (allocation: AllocationItem) => {
    const text = `${allocation.itemName} - ${allocation.paidBy} - ${
      allocation.amount ? `$${allocation.amount.toLocaleString()}` : "Not specified"
    } - ${allocation.notes || "—"}`;
    navigator.clipboard.writeText(text);
    toast.success("Copied allocation row!");
  };

  const copyAllAllocations = () => {
    const text = allocations
      .map(
        (a) =>
          `${a.itemName} - ${a.paidBy} - ${
            a.amount ? `$${a.amount.toLocaleString()}` : "Not specified"
          } - ${a.notes || "—"}`
      )
      .join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Copied all allocations!");
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

  if (fields.length === 0 && allocations.length === 0) return null;

  // ═══════════════════════════════════════════════════════════════════════
  // CHECK FOR EXTRACTION ERRORS (purchasePrice = 0)
  // ═══════════════════════════════════════════════════════════════════════
  const hasExtractionError = data.purchasePrice === 0;

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

      {/* ALLOCATION OF CLOSING COSTS TABLE */}
      {(allocations.length > 0 || isEditing) && (
        <Card className="overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <DollarSign className="h-5 w-5 text-blue-600" />
                <CardTitle className="text-lg font-bold">
                  Allocation of Closing Costs
                </CardTitle>
                <Badge variant="secondary" className="font-mono text-[10px] px-1.5 py-0">
                  {allocations.length} ITEMS
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                {!isEditing && allocations.length > 0 && (
                  <Button variant="outline" size="sm" onClick={copyAllAllocations}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy All
                  </Button>
                )}
                {isEditing && (
                  <Button variant="outline" size="sm" onClick={handleAddAllocation}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Item
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Cost Item</TableHead>
                    <TableHead className="font-semibold w-32">Paid By</TableHead>
                    <TableHead className="font-semibold w-40">Amount</TableHead>
                    <TableHead className="font-semibold">Notes</TableHead>
                    {!isEditing && <TableHead className="w-12"></TableHead>}
                    {isEditing && <TableHead className="w-12"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allocations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No closing cost allocations specified
                      </TableCell>
                    </TableRow>
                  ) : (
                    allocations.map((allocation, index) => (
                      <TableRow key={index} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="font-medium">
                          {isEditing ? (
                            <Input
                              value={allocation.itemName}
                              onChange={(e) =>
                                handleUpdateAllocation(index, "itemName", e.target.value)
                              }
                              placeholder="Cost item name"
                              className="min-w-[200px]"
                            />
                          ) : (
                            allocation.itemName || "—"
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Select
                              value={allocation.paidBy}
                              onValueChange={(val) =>
                                handleUpdateAllocation(index, "paidBy", val)
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Buyer">Buyer</SelectItem>
                                <SelectItem value="Seller">Seller</SelectItem>
                                <SelectItem value="Split">Split</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge
                              variant={
                                allocation.paidBy === "Buyer"
                                  ? "default"
                                  : allocation.paidBy === "Seller"
                                  ? "secondary"
                                  : "outline"
                              }
                              className="font-medium"
                            >
                              {allocation.paidBy}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Input
                              type="number"
                              value={allocation.amount || ""}
                              onChange={(e) =>
                                handleUpdateAllocation(
                                  index,
                                  "amount",
                                  e.target.value ? parseFloat(e.target.value) : null
                                )
                              }
                              placeholder="Amount"
                              className="w-full"
                            />
                          ) : allocation.amount ? (
                            <span className="font-semibold text-green-700 dark:text-green-400">
                              ${allocation.amount.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-sm">Not specified</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Input
                              value={allocation.notes || ""}
                              onChange={(e) =>
                                handleUpdateAllocation(index, "notes", e.target.value || null)
                              }
                              placeholder="Notes"
                              className="min-w-[150px]"
                            />
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              {allocation.notes || "—"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handleRemoveAllocation(index)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => copyAllocationRow(allocation)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
