// src/app/transactions/TransactionsClient.tsx
"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, FileText, Home } from "lucide-react";
import Link from "next/link";
import TransactionCard from "@/components/transactions/TransactionCard";
import { ParseResult } from "@/types";
import { toast } from "sonner";

type SortOption = "date" | "address" | "closing" | "price";

interface TransactionsClientProps {
  initialParses: ParseResult[];
}

export default function TransactionsClient({ initialParses }: TransactionsClientProps) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("date");

  // Simple client-side search & sort
  const filteredAndSorted = initialParses
    .filter((parse) => {
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

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/parse/delete/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Transaction deleted");
      // Optional: refetch or optimistic update
      window.location.reload();
    } catch {
      toast.error("Failed to delete");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-4xl font-bold mb-2">Transactions</h1>
          <p className="text-muted-foreground text-lg">
            {filteredAndSorted.length} active {filteredAndSorted.length === 1 ? "transaction" : "transactions"}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/upload">
            <FileText className="h-4 w-4 mr-2" />
            Upload New File
          </Link>
        </Button>
      </div>

      {/* Search + Sort */}
      <Card>
        <CardContent className="pt-6">
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
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}