// src/components/ExtractionCategories.tsx
// Version: 2.3.0 - 2026-01-13
// UPDATED: Reordered categories for F-shape (Terms first, Info last)
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
  viewContext?: "left" | "right";
}

export default function ExtractionCategories({
  data,
  isEditing = false,
  onDataChange,
  viewContext,
}: ExtractionCategoriesProps) {
  
  // Render Left Side: Purchasing Terms FIRST, Info LAST
  if (viewContext === "left") {
    return (
      <div className="space-y-8">
        <CategoryPurchaseTerms
          data={data}
          isEditing={isEditing}
          onDataChange={onDataChange}
        />
        {/* System metadata pushed to bottom of left column */}
        <div className="pt-6 border-t border-dashed">
          <CategoryTransactionInfo
            data={data}
            isEditing={isEditing}
            onDataChange={onDataChange}
          />
        </div>
      </div>
    );
  }

  // Render Right Side: Timeline & Representing Parties
  if (viewContext === "right") {
    return (
      <div className="space-y-8">
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
      </div>
    );
  }

  // Default / Mobile View (Stacking with Info at the bottom)
  return (
    <div className="space-y-8">
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
      <div className="pt-6 border-t border-dashed">
        <CategoryTransactionInfo
          data={data}
          isEditing={isEditing}
          onDataChange={onDataChange}
        />
      </div>
    </div>
  );
}
