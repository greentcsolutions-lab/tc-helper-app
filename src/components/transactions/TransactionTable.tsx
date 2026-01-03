// src/components/transactions/TransactionTable.tsx
"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Trash2, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import ExtractionCategories from "@/components/ExtractionCategories";
import { ParseResult } from "@/types";

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

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
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
            <th className="text-left p-4 font-semibold">Property Address</th>
            <th className="text-left p-4 font-semibold w-32">Type</th>
            <th className="text-left p-4 font-semibold w-40">Closing Date</th>
            <th className="text-left p-4 font-semibold w-48">Created</th>
            <th className="w-12 p-4"></th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction, index) => {
            const isExpanded = expandedRows.has(transaction.id);
            const isSelected = selectedIds.has(transaction.id);

            return (
              <tr
                key={transaction.id}
                className={`border-b last:border-b-0 ${
                  isExpanded ? "bg-primary/5" : "hover:bg-muted/30"
                } transition-colors`}
              >
                <td colSpan={6} className="p-0">
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
                      <div className="flex-1 p-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {transaction.propertyAddress || "Address Not Found"}
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
                      <div className="w-32 p-4">
                        <Badge variant={transaction.transactionType === 'listing' ? 'default' : 'secondary'}>
                          {formatTransactionType(transaction.transactionType)}
                        </Badge>
                      </div>
                      <div className="w-40 p-4 text-sm">
                        {formatDate(transaction.closingDate)}
                      </div>
                      <div className="w-48 p-4 text-sm text-muted-foreground">
                        {formatDateTime(transaction.createdAt)}
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
                            <ExtractionCategories data={transaction} />
                          </div>

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
  );
}
