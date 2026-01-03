// src/components/ExtractionCategories.tsx
// Version: 1.0.0-initial - 2025-12-24
"use client";

import CategoryPurchaseTerms from "./CategoryPurchaseTerms";
import CategoryRepresentingParties from "./CategoryRepresentingParties";
import CategoryTimelineContingencies from "./CategoryTimelineContingencies";
import { ParseResult } from "@/types";

export default function ExtractionCategories({ data }: { data: ParseResult }) {
  return (
    <div className="space-y-6">
      <CategoryPurchaseTerms data={data} />
      <CategoryTimelineContingencies data={data} />
      <CategoryRepresentingParties data={data} />
      {/* Future categories go here — one place to add them */}
    </div>
  );
}