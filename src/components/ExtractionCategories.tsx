// src/components/ExtractionCategories.tsx
// Version: 2.1.0 - 2026-01-03
// ENHANCED: Added edit mode support and transaction info category
"use client";

import CategoryTransactionInfo from "./CategoryTransactionInfo";
import CategoryPurchaseTerms from "./CategoryPurchaseTerms";
import CategoryRepresentingParties from "./CategoryRepresentingParties";
import CategoryTimelineContingencies from "./CategoryTimelineContingencies";
import { ParseResult } from "@/types";

interface ExtractionCategoriesProps {
  data: ParseResult;
  isEditing?: boolean;
  onDataChange?: (updatedData: ParseResult) => void;
}

export default function ExtractionCategories({
  data,
  isEditing = false,
  onDataChange,
}: ExtractionCategoriesProps) {
  return (
    <div className="space-y-6">
      <CategoryTransactionInfo
        data={data}
        isEditing={isEditing}
        onDataChange={onDataChange}
      />
      <CategoryPurchaseTerms
        data={data}
        isEditing={isEditing}
        onDataChange={onDataChange}
      />
      <CategoryTimelineContingencies
        data={data}
        isEditing={isEditing}
        onDataChange={onDataChange}
      />
      <CategoryRepresentingParties
        data={data}
        isEditing={isEditing}
        onDataChange={onDataChange}
      />
      {/* Future categories go here — one place to add them */}
    </div>
  );
}