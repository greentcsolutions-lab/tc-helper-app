// src/components/CategoryTimelineContingencies.tsx
// Version: 5.0.0 - 2026-01-15
// UPDATED: Uses new timelineDataStructured with calculated effective dates
//          Displays all dates in MM/DD/YYYY (source) format
//          Falls back to old fields for backwards compatibility

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

  // Helper: Get formatted timeline event from structured data
  const getTimelineEventDisplay = (eventKey: string): string | null => {
    if (!data.timelineDataStructured || typeof data.timelineDataStructured !== 'object') {
      return null;
    }

    const event = (data.timelineDataStructured as any)[eventKey];
    if (!event || !event.effectiveDate) {
      return null;
    }

    // Format the effective date
    const displayDate = formatDate(event.effectiveDate);
    if (!displayDate) return null;

    const shortDate = toShortYear(displayDate);

    // Build source description
    let source = '';
    if (event.dateType === 'specified') {
      source = 'specified';
    } else if (event.dateType === 'relative') {
      const dayType = event.dayType === 'business' ? 'business days' : 'days';
      const direction = event.direction === 'before' ? 'before' : 'after';
      const anchor = event.anchorPoint || 'acceptance';
      source = `${event.relativeDays} ${dayType} ${direction} ${anchor}`;
    }

    return `${shortDate} (${source})`;
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

  // === Close of Escrow ===
  const closingDisplay = !isEditing ? getTimelineEventDisplay('closing') : null;

  if (closingDisplay || data.closingDate || isEditing) {
    let display: string | null = closingDisplay;

    // Fallback to old format if no structured data
    if (!display && !isEditing) {
      if (typeof data.closingDate === 'number') {
        const formatted = formatTimelineField(data.closingDate, data.effectiveDate, false);
        if (formatted.displayDate) {
          const shortDate = toShortYear(formatted.displayDate);
          display = `${shortDate} (${data.closingDate} days after acceptance)`;
        } else {
          display = `${data.closingDate} days after acceptance`;
        }
      } else if (typeof data.closingDate === 'string') {
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

  // === Initial Deposit Due Date ===
  const depositDisplay = !isEditing ? getTimelineEventDisplay('initialDeposit') : null;

  if (depositDisplay || data.initialDepositDueDate || isEditing) {
    let display: string | null = depositDisplay;

    // Fallback to old format if no structured data
    if (!display && !isEditing) {
      if (typeof data.initialDepositDueDate === 'number') {
        const formatted = formatTimelineField(data.initialDepositDueDate, data.effectiveDate, false);
        if (formatted.displayDate) {
          const shortDate = toShortYear(formatted.displayDate);
          display = `${shortDate} (${data.initialDepositDueDate} days after acceptance)`;
        } else {
          display = `${data.initialDepositDueDate} days after acceptance`;
        }
      } else if (typeof data.initialDepositDueDate === 'string') {
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

  // === Seller Delivery of Disclosures ===
  const sellerDisclosuresDisplay = !isEditing ? getTimelineEventDisplay('sellerDisclosures') : null;

  if (sellerDisclosuresDisplay || data.sellerDeliveryOfDisclosuresDate || isEditing) {
    let display: string | null = sellerDisclosuresDisplay;

    // Fallback to old format if no structured data
    if (!display && !isEditing) {
      if (typeof data.sellerDeliveryOfDisclosuresDate === 'number') {
        const formatted = formatTimelineField(data.sellerDeliveryOfDisclosuresDate, data.effectiveDate, false);
        if (formatted.displayDate) {
          const shortDate = toShortYear(formatted.displayDate);
          display = `${shortDate} (${data.sellerDeliveryOfDisclosuresDate} days after acceptance)`;
        } else {
          display = `${data.sellerDeliveryOfDisclosuresDate} days after acceptance`;
        }
      } else if (typeof data.sellerDeliveryOfDisclosuresDate === 'string') {
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
  const inspectionDisplay = !isEditing ? getTimelineEventDisplay('inspectionContingency') : null;

  if (inspectionDisplay || cont?.inspectionDays != null || isEditing) {
    let display = inspectionDisplay;

    // Fallback to old format if no structured data
    if (!display && !isEditing) {
      display = formatContingencyDisplay(cont?.inspectionDays, "Inspection Contingency");
    }

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
  const appraisalDisplay = !isEditing ? getTimelineEventDisplay('appraisalContingency') : null;

  if (appraisalDisplay || cont?.appraisalDays != null || isEditing) {
    let display = appraisalDisplay;

    // Fallback to old format if no structured data
    if (!display && !isEditing) {
      display = formatContingencyDisplay(cont?.appraisalDays, "Appraisal Contingency");
    }

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
  const loanDisplay = !isEditing ? getTimelineEventDisplay('loanContingency') : null;

  if (loanDisplay || cont?.loanDays != null || isEditing) {
    let display = loanDisplay;

    // Fallback to old format if no structured data
    if (!display && !isEditing) {
      display = formatContingencyDisplay(cont?.loanDays, "Loan Contingency");
    }

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