// src/components/transactions/TransactionTable.tsx
"use client";

import { useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Trash2, AlertCircle, Edit, Save, X } from "lucide-react";
import { format } from "date-fns";
import ExtractionCategories from "@/components/ExtractionCategories";
import { ParseResult } from "@/types";
import { toast } from "sonner";

interface TransactionTableProps {
  transactions: ParseResult[];
  latestId: string | null;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onDelete: (id: string) => void;
}

export default function TransactionTable({
  transactions,
  latestId,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onDelete,
}: TransactionTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(
    new Set(latestId ? [latestId] : [])
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedData, setEditedData] = useState<ParseResult | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Warn user when navigating away with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const handleEdit = (transaction: ParseResult) => {
    if (hasUnsavedChanges) {
      if (!confirm('You have unsaved changes. Discard them?')) {
        return;
      }
    }
    setEditingId(transaction.id);
    setEditedData({ ...transaction });
    setHasUnsavedChanges(false);
    // Expand the row when entering edit mode
    const newExpanded = new Set(expandedRows);
    newExpanded.add(transaction.id);
    setExpandedRows(newExpanded);
  };

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      if (!confirm('Are you sure you want to discard your changes?')) {
        return;
      }
    }
    setEditingId(null);
    setEditedData(null);
    setHasUnsavedChanges(false);
  };

  const handleSave = async () => {
    if (!editedData || !editingId) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/transactions/update/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Core fields
          transactionType: editedData.transactionType,
          buyerNames: editedData.buyerNames,
          sellerNames: editedData.sellerNames,
          propertyAddress: editedData.propertyAddress,
          purchasePrice: editedData.purchasePrice,
          closingDate: editedData.closingDate,
          effectiveDate: editedData.effectiveDate,
          initialDepositDueDate: editedData.initialDepositDueDate,
          sellerDeliveryOfDisclosuresDate: editedData.sellerDeliveryOfDisclosuresDate,
          isAllCash: editedData.isAllCash,
          loanType: editedData.loanType,
          // JSON fields
          earnestMoneyDeposit: editedData.earnestMoneyDeposit,
          financing: editedData.financing,
          contingencies: editedData.contingencies,
          closingCosts: editedData.closingCosts,
          brokers: editedData.brokers,
          personalPropertyIncluded: editedData.personalPropertyIncluded,
          escrowHolder: editedData.escrowHolder,
        }),
      });

      if (!response.ok) throw new Error();

      toast.success('Transaction updated successfully');
      setEditingId(null);
      setEditedData(null);
      setHasUnsavedChanges(false);
      // Refresh the page to show updated data
      window.location.reload();
    } catch (error) {
      toast.error('Failed to update transaction');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDataChange = (updatedData: ParseResult) => {
    setEditedData(updatedData);
    setHasUnsavedChanges(true);
  };

  const formatTransactionType = (type: string | null) => {
    if (!type) return "Escrow"; // Default
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return "-";
    try {
      return format(new Date(date), "MMM d, yyyy");
    } catch {
      return "-";
    }
  };

  const formatDateTime = (date: string | Date) => {
    try {
      return format(new Date(date), "MMM d, yyyy 'at' h:mm a");
    } catch {
      return "-";
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="w-12 p-4">
                <Checkbox
                  checked={
                    selectedIds.size === transactions.length && transactions.length > 0
                  }
                  onCheckedChange={onToggleSelectAll}
                />
              </th>
              <th className="text-left p-4 font-semibold min-w-[300px]">Property Address</th>
              <th className="text-left p-4 font-semibold w-32 hidden md:table-cell">Type</th>
              <th className="text-left p-4 font-semibold w-40 hidden lg:table-cell">Closing Date</th>
              <th className="text-left p-4 font-semibold w-48 hidden xl:table-cell">Created</th>
              <th className="text-left p-4 font-semibold w-40">Actions</th>
              <th className="w-12 p-4"></th>
            </tr>
          </thead>
        <tbody>
          {transactions.map((transaction, index) => {
            const isExpanded = expandedRows.has(transaction.id);
            const isSelected = selectedIds.has(transaction.id);
            const isEditing = editingId === transaction.id;
            const displayData = isEditing && editedData ? editedData : transaction;

            return (
              <tr
                key={transaction.id}
                className={`border-b last:border-b-0 ${
                  isExpanded ? "bg-primary/5" : "hover:bg-muted/30"
                } transition-colors`}
              >
                <td colSpan={7} className="p-0">
                  <div>
                    {/* Main Row */}
                    <div className="flex items-center">
                      <div className="w-12 p-4 flex items-center justify-center">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => onToggleSelect(transaction.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      <div className="flex-1 p-4 min-w-[300px]">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {displayData.propertyAddress || "Address Not Found"}
                          </span>
                          {transaction.missingSCOs && (
                            <Badge variant="destructive" className="text-xs">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Missing SCO
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {transaction.fileName}
                        </p>
                      </div>
                      <div className="w-32 p-4 hidden md:table-cell">
                        <Badge variant={displayData.transactionType === 'listing' ? 'default' : 'secondary'}>
                          {formatTransactionType(displayData.transactionType)}
                        </Badge>
                      </div>
                      <div className="w-40 p-4 text-sm hidden lg:table-cell">
                        {formatDate(displayData.closingDate)}
                      </div>
                      <div className="w-48 p-4 text-sm text-muted-foreground hidden xl:table-cell">
                        {formatDateTime(transaction.createdAt)}
                      </div>
                      <div className="w-40 p-4">
                        {isEditing ? (
                          <div className="flex gap-1">
                            <Button
                              variant="default"
                              size="sm"
                              onClick={handleSave}
                              disabled={isSaving || !hasUnsavedChanges}
                              className="h-8"
                            >
                              <Save className="h-4 w-4 mr-1" />
                              Save
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleCancel}
                              disabled={isSaving}
                              className="h-8"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(transaction)}
                            className="h-8"
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                        )}
                      </div>
                      <div className="w-12 p-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleRow(transaction.id)}
                          className="h-8 w-8 p-0"
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="border-t bg-background">
                        <div className="p-6">
                          <div
                            className={
                              isExpanded
                                ? "animate-in slide-in-from-top-2 duration-300"
                                : ""
                            }
                          >
                            <ExtractionCategories
                              data={displayData}
                              isEditing={isEditing}
                              onDataChange={handleDataChange}
                            />
                          </div>

                          {!isEditing && (
                            <div className="flex justify-end mt-6">
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => onDelete(transaction.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}
