// src/app/dashboard/PastResultsClient.tsx

"use client";

import { format } from "date-fns";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, FileText, Home, Search, ChevronDown } from "lucide-react";
import Link from "next/link";
import CategoryPurchaseTerms from "@/components/CategoryPurchaseTerms";
import CategoryTimelineContingencies from "@/components/CategoryTimelineContingencies";
import CategoryRepresentingParties from "@/components/CategoryRepresentingParties";
import { useState } from "react";

function ResultCard({ parse, isLatest }: { parse: any; isLatest: boolean }) {
  const d = parse.formatted as any;
  const address = d.property_address?.full || "Address Not Found";
  const [isOpen, setIsOpen] = useState(isLatest);

  return (
    <Card className="overflow-hidden border-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left hover:bg-muted/50 transition-colors"
      >
        <CardHeader className="bg-primary/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <FileText className="h-8 w-8 text-primary" />
              <div>
                <h2 className="text-2xl font-bold">{address}</h2>
                <p className="text-sm text-muted-foreground">
                  {parse.fileName} • {format(parse.createdAt, "PPP 'at' p")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {parse.missingSCOs && (
                <Badge variant="destructive" className="text-lg">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Missing SCO
                </Badge>
              )}
              <ChevronDown
                className={`h-6 w-6 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
              />
            </div>
          </div>
        </CardHeader>
      </button>

      <div className={isOpen ? "" : "h-0 overflow-hidden"}>
        <CardContent className="p-6 space-y-6 border-t">
          <div className={isOpen ? "animate-in slide-in-from-top-2 duration-300" : ""}>
            <CategoryPurchaseTerms data={d} />
            <CategoryTimelineContingencies data={d} />
            <CategoryRepresentingParties data={d} />
          </div>
        </CardContent>
      </div>
    </Card>
  );
}

export default function PastResultsClient({ initialParses }: { initialParses: any[] }) {
  const [search, setSearch] = useState("");

  const filtered = initialParses.filter((parse) => {
    const d = parse.formatted as any;
    const address = (d.property_address?.full || "").toLowerCase();
    const agent = [
      d.buyers_broker?.agent_name_1,
      d.buyers_broker?.agent_name_2,
      d.sellers_broker?.agent_name_1,
      d.sellers_broker?.agent_name_2,
      d.buyers_broker?.brokerage_name,
      d.sellers_broker?.brokerage_name,
    ].filter(Boolean).join(" ").toLowerCase();
    const filename = parse.fileName.toLowerCase();

    return address.includes(search.toLowerCase()) ||
           agent.includes(search.toLowerCase()) ||
           filename.includes(search.toLowerCase());
  });

  const latestParseId = filtered.length > 0 ? filtered[0].id : null;

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8 flex items-center justify-between gap-4">
        <h1 className="text-4xl font-bold">Your RPA Results</h1>
        <Button asChild variant="outline">
          <Link href="/upload">
            <Home className="h-4 w-4 mr-2" />
            Upload New File
          </Link>
        </Button>
      </div>

      <div className="relative mb-8">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-5 w-5" />
        <Input
          placeholder="Search by address, agent, brokerage, or filename..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 text-lg"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">
            {search ? "No results found" : "No parses yet"}
          </h2>
        </div>
      ) : (
        <div className="space-y-8">
          {filtered.map((parse) => (
            <ResultCard
              key={parse.id}
              parse={parse}
              isLatest={parse.id === latestParseId}
            />
          ))}
        </div>
      )}
    </div>
  );
}