// src/components/CategoryTimelineContingencies.tsx
// Version: 2.0.0 - 2025-12-29
// FIXED: Proper null handling with type guards
// ENHANCED: Safe display for days/dates (handles both string and number)

import CategorySection from "./CategorySection";
import { Calendar } from "lucide-react";
import { ParseResult } from "@/types";

export default function CategoryTimelineContingencies({
  data,
}: {
  data: ParseResult;
}) {
  const cont = data.contingencies;

  // ═══════════════════════════════════════════════════════════════════════
  // HELPER: Format contingency days (number or string like "Waived")
  // ═══════════════════════════════════════════════════════════════════════
  const formatContingencyDays = (
    value: number | string | null | undefined
  ): string | null => {
    if (value === null || value === undefined) return null;
    
    if (typeof value === 'string') {
      // Already formatted (e.g., "Waived" or "2025-12-31")
      return value.trim() === '' ? null : value;
    }
    
    if (typeof value === 'number') {
      return `${value} days`;
    }
    
    return null;
  };

  // ═══════════════════════════════════════════════════════════════════════
  // HELPER: Safe string display
  // ═══════════════════════════════════════════════════════════════════════
  const formatString = (value: string | null | undefined): string | null => {
    if (typeof value !== 'string' || value.trim() === '') return null;
    return value;
  };

  // ═══════════════════════════════════════════════════════════════════════
  // HELPER: Format COP contingency
  // ═══════════════════════════════════════════════════════════════════════
  const formatCOPContingency = (value: boolean | undefined): string | null => {
    if (value === undefined) return null;
    return value ? "Active" : "Waived";
  };

  // ═══════════════════════════════════════════════════════════════════════
  // BUILD FIELD LIST WITH TYPE-SAFE GUARDS
  // ═══════════════════════════════════════════════════════════════════════
  const fields = [
    { 
      label: "Close of Escrow", 
      value: formatString(data.closingDate) 
    },
    {
      label: "Inspection Contingency",
      value: formatContingencyDays(cont?.inspectionDays),
    },
    {
      label: "Appraisal Contingency",
      value: formatContingencyDays(cont?.appraisalDays),
    },
    {
      label: "Loan Contingency",
      value: formatContingencyDays(cont?.loanDays),
    },
    {
      label: "Sale of Buyer Property Contingency",
      value: formatCOPContingency(cont?.saleOfBuyerProperty),
    },
  ].filter((f) => f.value !== null);

  if (fields.length === 0) return null;

  return (
    <CategorySection
      title="Timeline & Contingencies"
      icon={<Calendar className="h-6 w-6 text-blue-600" />}
      fields={fields}
      categoryName="Timeline"
      defaultOpen={true}
    />
  );
}