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
    console.log(`[getTimelineEventDisplay] Looking for event key: ${eventKey}`);
    console.log(`[getTimelineEventDisplay] timelineDataStructured type:`, typeof data.timelineDataStructured);
    console.log(`[getTimelineEventDisplay] timelineDataStructured:`, data.timelineDataStructured);

    if (!data.timelineDataStructured || typeof data.timelineDataStructured !== 'object') {
      console.log(`[getTimelineEventDisplay] No structured data found`);
      return null;
    }

    const event = (data.timelineDataStructured as any)[eventKey];
    console.log(`[getTimelineEventDisplay] Event for ${eventKey}:`, event);

    if (!event || !event.effectiveDate) {
      console.log(`[getTimelineEventDisplay] Event or effectiveDate missing for ${eventKey}`);
      return null;
    }

    // Format the effective date
    const displayDate = formatDate(event.effectiveDate);
    console.log(`[getTimelineEventDisplay] displayDate for ${eventKey}:`, displayDate);

    if (!displayDate) {
      console.log(`[getTimelineEventDisplay] displayDate is null for ${eventKey}`);
      return null;
    }

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

    const result = `${shortDate} (${source})`;
    console.log(`[getTimelineEventDisplay] Returning for ${eventKey}:`, result);
    return result;
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

  if (closingDisplay || isEditing) {
    fields.push(
      createField(
        "Close of Escrow",
        isEditing ? data.closingDate ?? '' : closingDisplay,
        'date',
        (val) => onDataChange?.({ ...data, closingDate: val })
      )
    );
  }

  // === Initial Deposit Due Date ===
  const depositDisplay = !isEditing ? getTimelineEventDisplay('initialDeposit') : null;

  if (depositDisplay || isEditing) {
    fields.push(
      createField(
        "Initial Deposit Due Date",
        isEditing ? data.initialDepositDueDate ?? '' : depositDisplay,
        'date',
        (val) => onDataChange?.({ ...data, initialDepositDueDate: val })
      )
    );
  }

  // === Seller Delivery of Disclosures ===
  const sellerDisclosuresDisplay = !isEditing ? getTimelineEventDisplay('sellerDisclosures') : null;

  if (sellerDisclosuresDisplay || isEditing) {
    fields.push(
      createField(
        "Seller Delivery of Disclosures",
        isEditing ? data.sellerDeliveryOfDisclosuresDate ?? '' : sellerDisclosuresDisplay,
        'date',
        (val) => onDataChange?.({ ...data, sellerDeliveryOfDisclosuresDate: val })
      )
    );
  }

  // === Inspection Contingency ===
  const inspectionDisplay = !isEditing ? getTimelineEventDisplay('inspectionContingency') : null;

  if (inspectionDisplay || isEditing) {
    fields.push(
      createField(
        "Inspection Contingency",
        isEditing ? cont?.inspectionDays ?? '' : inspectionDisplay,
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

  if (appraisalDisplay || isEditing) {
    fields.push(
      createField(
        "Appraisal Contingency",
        isEditing ? cont?.appraisalDays ?? '' : appraisalDisplay,
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

  if (loanDisplay || isEditing) {
    fields.push(
      createField(
        "Loan Contingency",
        isEditing ? cont?.loanDays ?? '' : loanDisplay,
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