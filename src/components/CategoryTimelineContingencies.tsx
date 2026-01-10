// src/components/CategoryTimelineContingencies.tsx
// Version: 4.5.0 - 2026-01-08
// FIXED: Matches current ParseResult (no closeOfEscrowDate or calculated deadlines)
//         Displays calculated/actual dates with origin information (e.g., "01/26/26 (17 days after acceptance OR specified)")
//         Full editing support
// FIXED: Date formatting - displays dates as MM/DD/YY with source information

import CategorySection, { FieldConfig } from "./CategorySection";
import { Calendar } from "lucide-react";
import { ParseResult } from "@/types";
import { formatDisplayDate } from "@/lib/date-utils";
import { formatTimelineField } from "@/lib/timeline/timeline-formatter";

interface CategoryTimelineContingenciesProps {
  data: ParseResult;
  isEditing?: boolean;
  onDataChange?: (updatedData: ParseResult) => void;
}

export default function CategoryTimelineContingencies({
  data,
  isEditing = false,
  onDataChange,
}: CategoryTimelineContingenciesProps) {
  const cont = data.contingencies;

  // Helper: Format date for display (YYYY-MM-DD → MM/DD/YYYY)
  const formatDate = (value: string | null | undefined): string | null => {
    if (typeof value !== 'string' || value.trim() === '') return null;
    try {
      return formatDisplayDate(value);
    } catch (e) {
      return value; // Return original if parsing fails
    }
  };

  // Helper: Convert MM/DD/YYYY to MM/DD/YY (2-digit year)
  const toShortYear = (dateStr: string): string => {
    const parts = dateStr.split('/');
    if (parts.length === 3 && parts[2].length === 4) {
      return `${parts[0]}/${parts[1]}/${parts[2].slice(-2)}`;
    }
    return dateStr;
  };

  // Helper: Format contingency field with calculated date and origin
  const formatContingencyDisplay = (
    days: string | number | null | undefined,
    label: string
  ): string | null => {
    if (days == null) return null;

    // Convert to number if it's a string
    const daysNum = typeof days === 'string' ? parseInt(days, 10) : days;
    if (isNaN(daysNum)) return String(days);

    const formatted = formatTimelineField(daysNum, data.effectiveDate, false);

    if (!formatted.displayDate) {
      // No acceptance date available, show just the days
      return `${daysNum} days after acceptance`;
    }

    // Convert to 2-digit year format
    const shortDate = toShortYear(formatted.displayDate);

    // Format: "01/26/26 (17 days after acceptance OR specified)"
    return `${shortDate} (${daysNum} days after acceptance)`;
  };

  const createField = (
    label: string,
    value: any,
    type: 'text' | 'number' | 'date' | 'boolean' | 'array' = 'text',
    onChange?: (val: any) => void
  ): FieldConfig => ({
    label,
    value,
    type,
    onChange,
  });

  const fields: FieldConfig[] = [];

  // === Close of Escrow (legacy closingDate) ===
  if (data.closingDate || isEditing) {
    let display: string | null = null;

    if (!isEditing) {
      if (typeof data.closingDate === 'number') {
        // It's days after acceptance
        const formatted = formatTimelineField(data.closingDate, data.effectiveDate, false);
        if (formatted.displayDate) {
          const shortDate = toShortYear(formatted.displayDate);
          display = `${shortDate} (${data.closingDate} days after acceptance)`;
        } else {
          display = `${data.closingDate} days after acceptance`;
        }
      } else if (typeof data.closingDate === 'string') {
        // It's a specific date
        const formatted = formatTimelineField(data.closingDate, data.effectiveDate, false);
        if (formatted.displayDate) {
          const shortDate = toShortYear(formatted.displayDate);
          display = `${shortDate} (specified)`;
        } else {
          display = formatDate(data.closingDate);
        }
      }
    }

    fields.push(
      createField(
        "Close of Escrow",
        isEditing ? data.closingDate ?? '' : display,
        'date',
        (val) => onDataChange?.({ ...data, closingDate: val })
      )
    );
  }

  // === Initial Deposit Due Date (Earnest Money) ===
  if (data.initialDepositDueDate || isEditing) {
    let display: string | null = null;

    if (!isEditing) {
      if (typeof data.initialDepositDueDate === 'number') {
        // It's days after acceptance
        const formatted = formatTimelineField(data.initialDepositDueDate, data.effectiveDate, false);
        if (formatted.displayDate) {
          const shortDate = toShortYear(formatted.displayDate);
          display = `${shortDate} (${data.initialDepositDueDate} days after acceptance)`;
        } else {
          display = `${data.initialDepositDueDate} days after acceptance`;
        }
      } else if (typeof data.initialDepositDueDate === 'string') {
        // It's a specific date
        const formatted = formatTimelineField(data.initialDepositDueDate, data.effectiveDate, false);
        if (formatted.displayDate) {
          const shortDate = toShortYear(formatted.displayDate);
          display = `${shortDate} (specified)`;
        } else {
          display = formatDate(data.initialDepositDueDate);
        }
      }
    }

    fields.push(
      createField(
        "Initial Deposit Due Date",
        isEditing ? data.initialDepositDueDate ?? '' : display,
        'date',
        (val) => onDataChange?.({ ...data, initialDepositDueDate: val })
      )
    );
  }

  // === Seller Delivery of Disclosures Date ===
  if (data.sellerDeliveryOfDisclosuresDate || isEditing) {
    let display: string | null = null;

    if (!isEditing) {
      if (typeof data.sellerDeliveryOfDisclosuresDate === 'number') {
        // It's days after acceptance
        const formatted = formatTimelineField(data.sellerDeliveryOfDisclosuresDate, data.effectiveDate, false);
        if (formatted.displayDate) {
          const shortDate = toShortYear(formatted.displayDate);
          display = `${shortDate} (${data.sellerDeliveryOfDisclosuresDate} days after acceptance)`;
        } else {
          display = `${data.sellerDeliveryOfDisclosuresDate} days after acceptance`;
        }
      } else if (typeof data.sellerDeliveryOfDisclosuresDate === 'string') {
        // It's a specific date
        const formatted = formatTimelineField(data.sellerDeliveryOfDisclosuresDate, data.effectiveDate, false);
        if (formatted.displayDate) {
          const shortDate = toShortYear(formatted.displayDate);
          display = `${shortDate} (specified)`;
        } else {
          display = formatDate(data.sellerDeliveryOfDisclosuresDate);
        }
      }
    }

    fields.push(
      createField(
        "Seller Delivery of Disclosures",
        isEditing ? data.sellerDeliveryOfDisclosuresDate ?? '' : display,
        'date',
        (val) => onDataChange?.({ ...data, sellerDeliveryOfDisclosuresDate: val })
      )
    );
  }

  // === Inspection Contingency ===
  if (cont?.inspectionDays != null || isEditing) {
    const display = formatContingencyDisplay(cont?.inspectionDays, "Inspection Contingency");

    fields.push(
      createField(
        "Inspection Contingency",
        isEditing ? cont?.inspectionDays ?? '' : display,
        'text',
        (val) => onDataChange?.({
          ...data,
          contingencies: { ...cont!, inspectionDays: val },
        })
  
      )
    );
  }

  // === Appraisal Contingency ===
  if (cont?.appraisalDays != null || isEditing) {
    const display = formatContingencyDisplay(cont?.appraisalDays, "Appraisal Contingency");

    fields.push(
      createField(
        "Appraisal Contingency",
        isEditing ? cont?.appraisalDays ?? '' : display,
        'text',
        (val) => onDataChange?.({
          ...data,
          contingencies: { ...cont!, appraisalDays: val },
        })
      )
    );
  }

  // === Loan Contingency ===
  if (cont?.loanDays != null || isEditing) {
    const display = formatContingencyDisplay(cont?.loanDays, "Loan Contingency");

    fields.push(
      createField(
        "Loan Contingency",
        isEditing ? cont?.loanDays ?? '' : display,
        'text',
        (val) => onDataChange?.({
          ...data,
          contingencies: { ...cont!, loanDays: val },
        })
      )
    );
  }

  // === Sale of Buyer Property Contingency ===
  if (cont?.saleOfBuyerProperty !== undefined || isEditing) {
    const display = cont?.saleOfBuyerProperty ? "Active" : "Waived";

    fields.push(
      createField(
        "Sale of Buyer Property Contingency",
        isEditing ? cont?.saleOfBuyerProperty : display,
        'boolean',
        (val) => onDataChange?.({
          ...data,
          contingencies: { ...cont!, saleOfBuyerProperty: val as boolean },
        })
      )
    );
  }

  if (fields.length === 0) return null;

  return (
    <CategorySection
      title="Timeline & Contingencies"
      icon={<Calendar className="h-6 w-6 text-blue-600" />}
      fields={fields}
      categoryName="Timeline"
      defaultOpen={true}
      isEditing={isEditing}
    />
  );
}