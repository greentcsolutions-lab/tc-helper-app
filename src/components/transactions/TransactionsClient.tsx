// src/app/transactions/TransactionsClient.tsx
"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, FileText, Archive } from "lucide-react";
import Link from "next/link";
import TransactionCard from "@/components/transactions/TransactionCard";
import ActionBar from "@/components/transactions/ActionBar";
import { ParseResult } from "@/types";
import { toast } from "sonner";

type SortOption = "date" | "address" | "closing" | "price";

interface TransactionsClientProps {
  initialParses: ParseResult[];
  userQuota: number;
  activeCount: number;
}

export default function TransactionsClient({
  initialParses,
  userQuota,
  activeCount
}: TransactionsClientProps) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("date");
  const [showArchived, setShowArchived] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isActioning, setIsActioning] = useState(false);

  // Simple client-side search & sort & filter
  const filteredAndSorted = initialParses
    .filter((parse) => {
      // Filter by archived status
      const isArchived = parse.status === "ARCHIVED";
      if (showArchived && !isArchived) return false;
      if (!showArchived && isArchived) return false;

      // Search filter
      const term = search.toLowerCase();
      return (
        parse.propertyAddress?.toLowerCase().includes(term) ||
        parse.fileName.toLowerCase().includes(term) ||
        parse.buyerNames?.some((n) => n.toLowerCase().includes(term)) ||
        parse.sellerNames?.some((n) => n.toLowerCase().includes(term))
      );
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "date":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "address":
          return (a.propertyAddress || "").localeCompare(b.propertyAddress || "");
        case "closing":
          return (a.closingDate || "").localeCompare(b.closingDate || "");
        case "price":
          return (b.purchasePrice || 0) - (a.purchasePrice || 0);
        default:
          return 0;
      }
    });

  const latestParseId = initialParses[0]?.id;
  const remainingSlots = userQuota - activeCount;

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredAndSorted.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAndSorted.map(p => p.id)));
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/parse/delete/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Transaction deleted");
      window.location.reload();
    } catch {
      toast.error("Failed to delete");
    }
  };

  const handleBulkArchive = async () => {
    if (selectedIds.size === 0) return;

    setIsActioning(true);
    try {
      const res = await fetch("/api/parse/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });

      if (!res.ok) throw new Error();

      toast.success(`${selectedIds.size} transaction(s) archived`);
      setSelectedIds(new Set());
      window.location.reload();
    } catch {
      toast.error("Failed to archive transactions");
    } finally {
      setIsActioning(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    if (!confirm(`Are you sure you want to delete ${selectedIds.size} transaction(s)? This cannot be undone.`)) {
      return;
    }

    setIsActioning(true);
    try {
      const res = await fetch("/api/parse/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });

      if (!res.ok) throw new Error();

      toast.success(`${selectedIds.size} transaction(s) deleted`);
      setSelectedIds(new Set());
      window.location.reload();
    } catch {
      toast.error("Failed to delete transactions");
    } finally {
      setIsActioning(false);
    }
  };

  return (
    <>
      <div className="space-y-6 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-4xl font-bold mb-2">Transactions</h1>
            <div className="space-y-1">
              <p className="text-muted-foreground text-lg">
                {filteredAndSorted.length} {showArchived ? "archived" : "active"} {filteredAndSorted.length === 1 ? "transaction" : "transactions"}
              </p>
              <p className="text-sm text-muted-foreground">
                You can create <span className="font-semibold text-primary">{remainingSlots}</span> more {remainingSlots === 1 ? "file" : "files"} before reaching your limit
              </p>
            </div>
          </div>
          <Button asChild variant="outline">
            <Link href="/upload">
              <FileText className="h-4 w-4 mr-2" />
              Upload New File
            </Link>
          </Button>
        </div>

        {/* Search + Sort + Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex gap-4 flex-col sm:flex-row">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-5 w-5" />
                  <Input
                    placeholder="Search by address, buyer, agent, or filename..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <SelectValue placeholder="Sort by..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">Latest First</SelectItem>
                    <SelectItem value="address">Address (A-Z)</SelectItem>
                    <SelectItem value="closing">Closing Date</SelectItem>
                    <SelectItem value="price">Purchase Price</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4">
                  {filteredAndSorted.length > 0 && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={selectedIds.size === filteredAndSorted.length && filteredAndSorted.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                      <span className="text-sm text-muted-foreground">
                        Select All ({filteredAndSorted.length})
                      </span>
                    </label>
                  )}
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={showArchived}
                    onCheckedChange={(checked: boolean) => {
                      setShowArchived(checked);
                      setSelectedIds(new Set()); // Clear selection when toggling view
                    }}
                  />
                  <Archive className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    View Archived
                  </span>
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

      {/* List or Empty State */}
      {filteredAndSorted.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">
              {search ? "No results found" : "No transactions yet"}
            </h2>
            <p className="text-muted-foreground mb-6">
              {search ? "Try adjusting your search terms" : "Upload your first contract to get started"}
            </p>
            {!search && (
              <Button asChild>
                <Link href="/upload">
                  <FileText className="h-4 w-4 mr-2" />
                  Upload Contract
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredAndSorted.map((parse) => (
            <TransactionCard
              key={parse.id}
              parse={parse}
              isLatest={parse.id === latestParseId}
              isSelected={selectedIds.has(parse.id)}
              onToggleSelect={toggleSelect}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
      </div>

      {/* Action Bar */}
      <ActionBar
        selectedCount={selectedIds.size}
        onArchive={handleBulkArchive}
        onDelete={handleBulkDelete}
        onCancel={clearSelection}
        isLoading={isActioning}
      />
    </>
  );
}