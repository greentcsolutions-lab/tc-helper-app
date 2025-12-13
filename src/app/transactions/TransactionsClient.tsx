// src/app/transactions/TransactionsClient.tsx
// Version: 1.0.0
// Main client component for transactions page with search, sort, and delete

"use client";

import { useState } from "react";
import { format, parseISO, isValid, isBefore, addDays } from "date-fns";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  FileText,
  Search,
  ChevronDown,
  Trash2,
  CheckCircle,
  Clock,
  XCircle,
  Home,
} from "lucide-react";
import Link from "next/link";
import CategoryPurchaseTerms from "@/components/CategoryPurchaseTerms";
import CategoryTimelineContingencies from "@/components/CategoryTimelineContingencies";
import CategoryRepresentingParties from "@/components/CategoryRepresentingParties";
import { toast } from "sonner";

type SortOption = "date" | "address" | "closing" | "price";

interface TransactionCardProps {
  parse: any;
  isLatest: boolean;
  onDelete: (id: string) => void;
}

// Helper to parse date strings
function parseDate(dateStr: string | number | undefined): Date | null {
  if (!dateStr) return null;
  if (typeof dateStr === "number") return null;

  // Try MM/DD/YYYY format
  const mmddyyyyRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  const match = dateStr.match(mmddyyyyRegex);
  if (match) {
    const [, month, day, year] = match;
    const date = new Date(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`);
    return isValid(date) ? date : null;
  }

  try {
    const date = parseISO(dateStr);
    return isValid(date) ? date : null;
  } catch {
    return null;
  }
}

// Calculate transaction status based on closing date
function getTransactionStatus(data: any): "PENDING" | "COMPLETED" | "EXPIRED" {
  const closeOfEscrow = data.close_of_escrow;

  if (!closeOfEscrow) return "PENDING";

  let closeDate: Date | null = null;

  // If it's a number of days, calculate from acceptance date
  if (typeof closeOfEscrow === "number") {
    const acceptanceDate = parseDate(data.final_acceptance_date);
    if (acceptanceDate) {
      closeDate = addDays(acceptanceDate, closeOfEscrow);
    }
  } else {
    closeDate = parseDate(closeOfEscrow);
  }

  if (!closeDate) return "PENDING";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  closeDate.setHours(0, 0, 0, 0);

  // If closing date has passed, it's EXPIRED (unless marked as completed elsewhere)
  if (isBefore(closeDate, today)) {
    return "EXPIRED";
  }

  return "PENDING";
}

function TransactionCard({ parse, isLatest, onDelete }: TransactionCardProps) {
  const [isOpen, setIsOpen] = useState(isLatest);
  const [isDeleting, setIsDeleting] = useState(false);
  const data = parse.formatted as any;
  const address = data.property_address?.full || "Address Not Found";
  const status = getTransactionStatus(data);

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete this transaction?\n\n${address}`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/parse/delete/${parse.id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Delete failed");

      toast.success("Transaction deleted");
      onDelete(parse.id);
    } catch (err) {
      toast.error("Failed to delete transaction");
      setIsDeleting(false);
    }
  };

  const statusConfig = {
    PENDING: {
      icon: Clock,
      color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      label: "Pending Close",
    },
    COMPLETED: {
      icon: CheckCircle,
      color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      label: "Completed",
    },
    EXPIRED: {
      icon: XCircle,
      color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      label: "Past Due",
    },
  };

  const StatusIcon = statusConfig[status].icon;

  return (
    <Card className="overflow-hidden border-2 hover:border-primary/30 transition-colors">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left hover:bg-muted/50 transition-colors"
      >
        <CardHeader className="bg-muted/30">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Home className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold truncate">{address}</h2>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <p className="text-sm text-muted-foreground">
                    {parse.fileName}
                  </p>
                  <span className="text-muted-foreground">•</span>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(parse.createdAt), "MMM d, yyyy")}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Badge className={`${statusConfig[status].color} gap-1.5`}>
                <StatusIcon className="h-3.5 w-3.5" />
                {statusConfig[status].label}
              </Badge>
              {parse.missingSCOs && (
                <Badge variant="destructive" className="gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Missing Info
                </Badge>
              )}
              <ChevronDown
                className={`h-6 w-6 text-muted-foreground transition-transform duration-300 ${
                  isOpen ? "rotate-180" : ""
                }`}
              />
            </div>
          </div>
        </CardHeader>
      </button>

      <div
        className={`transition-all duration-300 ${
          isOpen ? "max-h-[10000px] opacity-100" : "max-h-0 opacity-0 overflow-hidden"
        }`}
      >
        <CardContent className="p-6 space-y-6 border-t">
          <div
            className={
              isOpen ? "animate-in slide-in-from-top-2 duration-300" : ""
            }
          >
            <CategoryPurchaseTerms data={data} />
            <div className="mt-6">
              <CategoryTimelineContingencies data={data} />
            </div>
            <div className="mt-6">
              <CategoryRepresentingParties data={data} />
            </div>

            {/* Delete button */}
            <div className="mt-8 pt-6 border-t flex justify-end">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {isDeleting ? "Deleting..." : "Delete Transaction"}
              </Button>
            </div>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}

export default function TransactionsClient({
  initialParses,
}: {
  initialParses: any[];
}) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("date");
  const [parses, setParses] = useState(initialParses);

  const handleDelete = (id: string) => {
    setParses((prev) => prev.filter((p) => p.id !== id));
  };

  // Filter by search
  const filtered = parses.filter((parse) => {
    const data = parse.formatted as any;
    const searchStr = search.toLowerCase();

    const address = (data.property_address?.full || "").toLowerCase();
    const buyerNames = Array.isArray(data.buyer_names)
      ? data.buyer_names.join(" ").toLowerCase()
      : "";
    const agents = [
      data.buyers_broker?.agent_name,
      data.sellers_broker?.agent_name,
      data.buyers_broker?.brokerage_name,
      data.sellers_broker?.brokerage_name,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const filename = parse.fileName.toLowerCase();

    return (
      address.includes(searchStr) ||
      buyerNames.includes(searchStr) ||
      agents.includes(searchStr) ||
      filename.includes(searchStr)
    );
  });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    const aData = a.formatted as any;
    const bData = b.formatted as any;

    switch (sortBy) {
      case "date":
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

      case "address":
        const aAddr = aData.property_address?.full || "";
        const bAddr = bData.property_address?.full || "";
        return aAddr.localeCompare(bAddr);

      case "closing": {
        const aClose = parseDate(aData.close_of_escrow);
        const bClose = parseDate(bData.close_of_escrow);
        if (!aClose && !bClose) return 0;
        if (!aClose) return 1;
        if (!bClose) return -1;
        return aClose.getTime() - bClose.getTime();
      }

      case "price": {
        const aPrice = parseFloat(
          (aData.purchase_price || "0").replace(/[$,]/g, "")
        );
        const bPrice = parseFloat(
          (bData.purchase_price || "0").replace(/[$,]/g, "")
        );
        return bPrice - aPrice;
      }

      default:
        return 0;
    }
  });

  const latestParseId = sorted.length > 0 ? sorted[0].id : null;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-4xl font-bold mb-2">Transactions</h1>
          <p className="text-muted-foreground text-lg">
            {sorted.length} active {sorted.length === 1 ? "transaction" : "transactions"}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/upload">
            <FileText className="h-4 w-4 mr-2" />
            Upload New File
          </Link>
        </Button>
      </div>

      {/* Search and Sort Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 flex-col sm:flex-row">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-5 w-5" />
              <Input
                placeholder="Search by address, buyer, agent, brokerage, or filename..."
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
        </CardContent>
      </Card>

      {/* Transactions List */}
      {sorted.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">
              {search ? "No results found" : "No transactions yet"}
            </h2>
            <p className="text-muted-foreground mb-6">
              {search
                ? "Try adjusting your search terms"
                : "Upload your first contract to get started"}
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
          {sorted.map((parse) => (
            <TransactionCard
              key={parse.id}
              parse={parse}
              isLatest={parse.id === latestParseId}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
