// src/components/transactions/TransactionTable.tsx
// Version 3.0.0 MAJOR UI UPDATE - F shape layout 

"use client";

import { useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, ChevronDown, Trash2, AlertCircle, Edit, Save, X } from "lucide-react";
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
      if (!confirm('You have unsaved changes. Discard them?')) return;
    }
    setEditingId(transaction.id);
    setEditedData({ ...transaction });
    setHasUnsavedChanges(false);
    const newExpanded = new Set(expandedRows);
    newExpanded.add(transaction.id);
    setExpandedRows(newExpanded);
  };

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      if (!confirm('Are you sure you want to discard your changes?')) return;
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
        body: JSON.stringify(editedData),
      });
      if (!response.ok) throw new Error();
      toast.success('Transaction updated successfully');
      setEditingId(null);
      setEditedData(null);
      setHasUnsavedChanges(false);
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
    if (!type) return "Escrow";
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
        <table className="w-full table-fixed md:table-auto">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="w-10 md:w-12 p-2 md:p-4">
                <Checkbox
                  checked={selectedIds.size === transactions.length && transactions.length > 0}
                  onCheckedChange={onToggleSelectAll}
                />
              </th>
              <th className="text-left p-2 md:p-4 font-semibold min-w-[150px] md:min-w-[300px]">Property</th>
              <th className="text-left p-4 font-semibold w-32 hidden md:table-cell">Type</th>
              <th className="text-left p-4 font-semibold w-40 hidden lg:table-cell">Closing</th>
              <th className="text-left p-4 font-semibold w-40 hidden xl:table-cell">Created</th>
              <th className="text-right md:text-left p-2 md:p-4 font-semibold w-24 md:w-40">Actions</th>
              <th className="w-10 md:w-12 p-2 md:p-4"></th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((transaction) => {
              const isExpanded = expandedRows.has(transaction.id);
              const isSelected = selectedIds.has(transaction.id);
              const isEditing = editingId === transaction.id;
              const displayData = isEditing && editedData ? editedData : transaction;

              return (
                <tr
                  key={transaction.id}
                  className={`border-b last:border-b-0 ${isExpanded ? "bg-primary/5" : "hover:bg-muted/30"} transition-colors cursor-pointer group`}
                  onClick={() => toggleRow(transaction.id)}
                >
                  <td colSpan={7} className="p-0">
                    <div className="flex items-center w-full">
                      <div className="w-10 md:w-12 p-2 md:p-4 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={isSelected} onCheckedChange={() => onToggleSelect(transaction.id)} />
                      </div>

                      <div className="flex-1 p-2 md:p-4 min-w-0">
                        <div className="flex items-center gap-1 md:gap-2">
                          <span className="font-medium text-sm md:text-base truncate block group-hover:text-primary transition-colors">
                            {displayData.propertyAddress || "Address Not Found"}
                          </span>
                          {transaction.missingSCOs && (
                            <Badge variant="destructive" className="scale-75 md:scale-100 origin-left">
                              <AlertCircle className="h-3 w-3 mr-1" /> Missing SCO
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] md:text-sm text-muted-foreground truncate">{transaction.fileName}</p>
                      </div>

                      <div className="w-32 p-4 hidden md:table-cell">
                        <Badge variant={displayData.transactionType === 'listing' ? 'default' : 'secondary'}>
                          {formatTransactionType(displayData.transactionType)}
                        </Badge>
                      </div>
                      <div className="w-40 p-4 text-sm hidden lg:table-cell">{formatDate(displayData.closingDate)}</div>

                      <div className="w-24 md:w-40 p-2 md:p-4 flex justify-end md:justify-start" onClick={(e) => e.stopPropagation()}>
                        {isEditing ? (
                          <div className="flex gap-1">
                            <Button size="icon" variant="default" onClick={handleSave} className="h-8 w-8 md:w-auto md:px-3">
                              <Save className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="outline" onClick={handleCancel} className="h-8 w-8">
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => handleEdit(transaction)} className="h-8 px-2 md:px-3">
                            <Edit className="h-4 w-4 md:mr-2" />
                            <span className="hidden md:inline">Edit</span>
                          </Button>
                        )}
                      </div>

                      <div className="w-10 md:w-12 p-2 md:p-4 text-muted-foreground">
                         {isExpanded ? <ChevronDown className="h-4 w-4 md:h-5 md:w-5" /> : <ChevronRight className="h-4 w-4 md:h-5 md:w-5" />}
                      </div>
                    </div>

                    {isExpanded && (
                      <div 
                        className="border-t bg-background p-4 md:p-6 animate-in slide-in-from-top-2 duration-300 cursor-default"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-6">
                            <ExtractionCategories
                              data={displayData}
                              isEditing={isEditing}
                              onDataChange={handleDataChange}
                              viewContext="left"
                            />
                          </div>
                          <div className="space-y-6 md:border-l md:pl-8">
                            <ExtractionCategories
                              data={displayData}
                              isEditing={isEditing}
                              onDataChange={handleDataChange}
                              viewContext="right"
                            />
                            {!isEditing && (
                              <div className="flex justify-end mt-12 pt-6 border-t">
                                <Button variant="destructive" size="sm" onClick={() => onDelete(transaction.id)}>
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete Transaction
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
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
