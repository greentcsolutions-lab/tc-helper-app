// src/components/CategoryTimelineContingencies.tsx
// Version: 3.0.0 - 2026-01-03
// ENHANCED: Added missing timeline fields, chronological sorting, standardized formatting

import CategorySection from "./CategorySection";
import { Calendar } from "lucide-react";
import { ParseResult } from "@/types";
import { format, parseISO } from "date-fns";

interface TimelineField {
  label: string;
  value: string;
  calculatedDate: Date | null; // For sorting
}

export default function CategoryTimelineContingencies({
  data,
}: {
  data: ParseResult;
}) {
  const cont = data.contingencies;

  // ═══════════════════════════════════════════════════════════════════════
  // HELPER: Format date with source annotation
  // Returns "MM/DD/YYYY (source)" or null if not available
  // ═══════════════════════════════════════════════════════════════════════
  const formatDateWithSource = (
    value: string | number | null | undefined,
    fieldType: 'business_days' | 'calendar_days' | 'date'
  ): { display: string; date: Date } | null => {
    if (!value) return null;

    try {
      // Handle direct date strings (YYYY-MM-DD format)
      if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const date = parseISO(value);
        const formatted = format(date, 'MM/dd/yyyy');
        return {
          display: `${formatted} (specified)`,
          date
        };
      }

      // Handle "X days" strings
      if (typeof value === 'string' && value.includes('days')) {
        return null; // Can't format without acceptance date
      }

      // Handle number of days (but we need acceptance date to calculate)
      if (typeof value === 'number') {
        // We can't calculate without acceptance date, just show the days
        const daysLabel = fieldType === 'business_days' ? 'business days' : 'days';
        return null; // Don't show if we can't calculate actual date
      }

      return null;
    } catch {
      return null;
    }
  };

  // ═══════════════════════════════════════════════════════════════════════
  // BUILD TIMELINE FIELDS LIST
  // ═══════════════════════════════════════════════════════════════════════
  const timelineFields: TimelineField[] = [];

  // Close of Escrow
  const closingFormatted = formatDateWithSource(data.closingDate, 'date');
  if (closingFormatted) {
    timelineFields.push({
      label: "Close of Escrow",
      value: closingFormatted.display,
      calculatedDate: closingFormatted.date
    });
  }

  // Initial Deposit / EMD Due
  const initialDepositFormatted = formatDateWithSource(data.initialDepositDueDate, 'business_days');
  if (initialDepositFormatted) {
    timelineFields.push({
      label: "Initial Deposit / EMD Due",
      value: initialDepositFormatted.display,
      calculatedDate: initialDepositFormatted.date
    });
  }

  // Seller Delivery of Documents
  const sellerDeliveryFormatted = formatDateWithSource(data.sellerDeliveryOfDisclosuresDate, 'calendar_days');
  if (sellerDeliveryFormatted) {
    timelineFields.push({
      label: "Seller Delivery of Documents",
      value: sellerDeliveryFormatted.display,
      calculatedDate: sellerDeliveryFormatted.date
    });
  }

  // Inspection Contingency
  const inspectionFormatted = formatDateWithSource(cont?.inspectionDays, 'calendar_days');
  if (inspectionFormatted) {
    timelineFields.push({
      label: "Inspection Contingency",
      value: inspectionFormatted.display,
      calculatedDate: inspectionFormatted.date
    });
  }

  // Appraisal Contingency
  const appraisalFormatted = formatDateWithSource(cont?.appraisalDays, 'calendar_days');
  if (appraisalFormatted) {
    timelineFields.push({
      label: "Appraisal Contingency",
      value: appraisalFormatted.display,
      calculatedDate: appraisalFormatted.date
    });
  }

  // Loan Contingency
  const loanFormatted = formatDateWithSource(cont?.loanDays, 'calendar_days');
  if (loanFormatted) {
    timelineFields.push({
      label: "Loan Contingency",
      value: loanFormatted.display,
      calculatedDate: loanFormatted.date
    });
  }

  // Sale of Buyer Property Contingency (boolean, different format)
  if (cont?.saleOfBuyerProperty !== undefined) {
    const copValue = cont.saleOfBuyerProperty ? "Active" : "Waived";
    timelineFields.push({
      label: "Sale of Buyer Property Contingency",
      value: copValue,
      calculatedDate: null // No date for boolean field
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SORT CHRONOLOGICALLY (fields with dates first, then others)
  // ═══════════════════════════════════════════════════════════════════════
  timelineFields.sort((a, b) => {
    // If both have dates, sort by date
    if (a.calculatedDate && b.calculatedDate) {
      return a.calculatedDate.getTime() - b.calculatedDate.getTime();
    }
    // Fields without dates go to the end
    if (!a.calculatedDate && b.calculatedDate) return 1;
    if (a.calculatedDate && !b.calculatedDate) return -1;
    return 0;
  });

  // Convert to CategorySection format
  const fields = timelineFields.map(f => ({
    label: f.label,
    value: f.value
  }));

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