// src/components/ExtractionCategories.tsx
// Version: 2.4.0 - 2026-01-17
// UPDATED: Reordered categories for F-shape (Terms first, Info last)
// UPDATED: Added tasks prop for timeline completion status
"use client";

import CategoryTransactionInfo from "./CategoryTransactionInfo";
import CategoryPurchaseTerms from "./CategoryPurchaseTerms";
import CategoryRepresentingParties from "./CategoryRepresentingParties";
import CategoryTimelineContingencies from "./CategoryTimelineContingencies";
import { ParseResult } from "@/types";

type Task = any; // Use Prisma-generated type

interface ExtractionCategoriesProps {
  data: ParseResult;
  isEditing?: boolean;
  onDataChange?: (updatedData: ParseResult) => void;
  viewContext?: "left" | "right";
  tasks?: Task[]; // Optional tasks for timeline completion status
}

export default function ExtractionCategories({
  data,
  isEditing = false,
  onDataChange,
  viewContext,
  tasks = [],
}: ExtractionCategoriesProps) {
  
  if (viewContext === "left") {
    return (
      <div className="space-y-8">
        <CategoryPurchaseTerms
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

  if (viewContext === "right") {
    return (
      <div className="space-y-8">
        <CategoryTimelineContingencies
          data={data}
          isEditing={isEditing}
          onDataChange={onDataChange}
          tasks={tasks}
        />
        <CategoryRepresentingParties
          data={data}
          isEditing={isEditing}
          onDataChange={onDataChange}
        />
      </div>
    );
  }

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
        tasks={tasks}
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
