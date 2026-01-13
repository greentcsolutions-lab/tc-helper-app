// src/components/ExtractionCategories.tsx
// Version: 2.2.0 - 2026-01-13
// UPDATED: Added viewContext for F-shape desktop layout
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
  viewContext?: "left" | "right"; // Determines which side of the F-shape to render
}

export default function ExtractionCategories({
  data,
  isEditing = false,
  onDataChange,
  viewContext,
}: ExtractionCategoriesProps) {
  
  // Render Left Side: Purchasing Terms & Core Info
  if (viewContext === "left") {
    return (
      <div className="space-y-8">
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

  // Default / Mobile View (Stack everything)
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
    </div>
  );
}
