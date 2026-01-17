// src/components/transactions/TransactionsClient.tsx
// Version 3.2.0 major UI update
"use client";

import { useState } from "react";
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
import { Search, FileText, Plus } from "lucide-react";
import Link from "next/link";
import TransactionTable from "@/components/transactions/TransactionTable";
import ActionBar from "@/components/transactions/ActionBar";
import { ParseResult } from "@/types";
import { toast } from "sonner";

type SortOption = "date" | "address" | "closing" | "price";
type Task = any; // Use Prisma-generated type

interface TransactionsClientProps {
  initialParses: ParseResult[];
  userQuota: number;
  activeCount: number;
  tasks?: Task[]; // Optional tasks for timeline completion status
}

export default function TransactionsClient({
  initialParses,
  userQuota,
  activeCount,
  tasks = [],
}: TransactionsClientProps) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("date");
  const [showArchived, setShowArchived] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isActioning, setIsActioning] = useState(false);

  // Sorting Logic
  const filteredAndSorted = initialParses
    .filter((parse) => {
      const isArchived = parse.status === "ARCHIVED";
      if (showArchived && !isArchived) return false;
      if (!showArchived && isArchived) return false;

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

  // Selection Logic
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

  const clearSelection = () => setSelectedIds(new Set());

  // --- ACTION HANDLERS ---

  // Single Archive (New)
  const handleArchive = async (id: string) => {
    try {
      const res = await fetch("/api/parse/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }), 
      });
      if (!res.ok) throw new Error();
      toast.success("Transaction archived");
      window.location.reload();
    } catch {
      toast.error("Failed to archive");
    }
  };

  // Single Delete
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this transaction?")) return;
    try {
      const res = await fetch(`/api/parse/delete/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Transaction deleted");
      window.location.reload();
    } catch {
      toast.error("Failed to delete");
    }
  };

  // Bulk Actions
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
      window.location.reload();
    } catch {
      toast.error("Failed to archive");
    } finally {
      setIsActioning(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} transaction(s)?`)) return;
    setIsActioning(true);
    try {
      const res = await fetch("/api/parse/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (!res.ok) throw new Error();
      toast.success("Deleted successfully");
      window.location.reload();
    } catch {
      toast.error("Failed to delete");
    } finally {
      setIsActioning(false);
    }
  };

  return (
    <>
      <div className="max-w-[1600px] mx-auto space-y-4 p-6">
        {/* Title & Quota Info */}
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
          <p className="text-sm text-muted-foreground">
            {activeCount} active transactions — You can create <span className="font-medium text-foreground">{remainingSlots}</span> more before your limit.
          </p>
        </div>

        {/* Toolbar: Search, Sort, Filter */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex flex-1 items-center gap-3 min-w-[300px]">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by address, buyer, or filename..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10 bg-background"
              />
            </div>

            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-[220px] h-10 bg-background">
                <span className="text-muted-foreground mr-1">Sort by:</span>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Latest First</SelectItem>
                <SelectItem value="address">Address (A-Z)</SelectItem>
                <SelectItem value="closing">Closing Date</SelectItem>
                <SelectItem value="price">Purchase Price</SelectItem>
              </SelectContent>
            </Select>

            <label className="flex items-center gap-2 px-2 cursor-pointer select-none">
              <Checkbox
                checked={showArchived}
                onCheckedChange={(checked: boolean) => {
                  setShowArchived(checked);
                  clearSelection();
                }}
              />
              <span className="text-sm font-medium text-muted-foreground">View Archived</span>
            </label>
          </div>

          <Button asChild className="h-10 px-4 shadow-sm">
            <Link href="/upload">
              <Plus className="h-4 w-4 mr-2" />
              Upload New File
            </Link>
          </Button>
        </div>

        {/* Table Section */}
        <div className="pt-2">
          {filteredAndSorted.length === 0 ? (
            <div className="border rounded-xl border-dashed py-20 text-center bg-card/50">
              <FileText className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
              <h2 className="text-xl font-semibold">
                {search ? "No matches found" : "No transactions yet"}
              </h2>
              <p className="text-muted-foreground text-sm mt-1">
                {search ? "Try adjusting your filters" : "Upload your first contract to see it here"}
              </p>
            </div>
          ) : (
            <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
              <TransactionTable
                transactions={filteredAndSorted}
                latestId={latestParseId}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onToggleSelectAll={toggleSelectAll}
                onDelete={handleDelete}
                onArchive={handleArchive} // Wired to the cabinet button
                tasks={tasks}
              />
            </div>
          )}
        </div>
      </div>

      {/* Floating Bulk Action Bar */}
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
