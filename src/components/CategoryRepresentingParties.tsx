// src/components/CategoryRepresentingParties.tsx
// Version: 2.0.0 - 2025-12-29
// FIXED: Proper null handling with type guards
// ENHANCED: Safe string validation to prevent undefined/null display

import CategorySection from "./CategorySection";
import { Users } from "lucide-react";
import { ParseResult } from "@/types";

export default function CategoryRepresentingParties({
  data,
}: {
  data: ParseResult;
}) {
  const brokers = data.brokers;

  // ═══════════════════════════════════════════════════════════════════════
  // HELPER: Safe string display
  // ═══════════════════════════════════════════════════════════════════════
  const formatString = (value: string | null | undefined): string | null => {
    if (typeof value !== 'string' || value.trim() === '') return null;
    return value;
  };

  // ═══════════════════════════════════════════════════════════════════════
  // BUILD FIELD LIST WITH TYPE-SAFE GUARDS
  // ═══════════════════════════════════════════════════════════════════════
  const fields = [
    { label: "Listing Brokerage", value: formatString(brokers?.listingBrokerage) },
    { label: "Listing Agent", value: formatString(brokers?.listingAgent) },
    { label: "Selling Brokerage", value: formatString(brokers?.sellingBrokerage) },
    { label: "Selling Agent", value: formatString(brokers?.sellingAgent) },
  ].filter((f) => f.value !== null);

  if (fields.length === 0) return null;

  return (
    <CategorySection
      title="Representing Parties"
      icon={<Users className="h-6 w-6 text-indigo-600" />}
      fields={fields}
      categoryName="Representing Parties"
      defaultOpen={true}
    />
  );
}