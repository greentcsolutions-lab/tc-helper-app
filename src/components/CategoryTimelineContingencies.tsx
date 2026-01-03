// src/components/CategoryTimelineContingencies.tsx
// Version: 4.0.0 - 2026-01-03
// ENHANCED: Added edit mode support, missing timeline fields, chronological sorting, standardized formatting

import CategorySection, { FieldConfig } from "./CategorySection";
import { Calendar } from "lucide-react";
import { ParseResult } from "@/types";
import { format, parseISO } from "date-fns";

interface TimelineField {
  label: string;
  value: string;
  calculatedDate: Date | null; // For sorting
}

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

  // Extract timeline source from extractionDetails if available
  const timelineSource = (data.extractionDetails as any)?.timelineSource;

  // ═══════════════════════════════════════════════════════════════════════
  // HELPER: Format date with source annotation
  // Returns "MM/DD/YYYY (source)" or null if not available
  // ═══════════════════════════════════════════════════════════════════════
  const formatDateWithSource = (
    value: string | number | null | undefined,
    sourceKey: string,
    fieldType: 'business_days' | 'calendar_days' | 'date'
  ): { display: string; date: Date } | null => {
    if (!value) return null;

    try {
      // Handle direct date strings (YYYY-MM-DD format)
      if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const date = parseISO(value);
        const formatted = format(date, 'MM/dd/yyyy');

        // Check if we have source information
        const sourceDays = timelineSource?.[sourceKey];
        let sourceLabel = 'specified';

        if (typeof sourceDays === 'number') {
          const daysLabel = fieldType === 'business_days' ? 'business days' : 'days';
          sourceLabel = `${sourceDays} ${daysLabel}`;
        }

        return {
          display: `${formatted} (${sourceLabel})`,
          date
        };
      }

      // Handle "X days" strings
      if (typeof value === 'string' && value.includes('days')) {
        return null; // Can't format without acceptance date
      }

      // Handle number of days (but we need acceptance date to calculate)
      if (typeof value === 'number') {
        return null; // Don't show if we can't calculate actual date
      }

      return null;
    } catch {
      return null;
    }
  };

  // ═══════════════════════════════════════════════════════════════════════
  // HELPER: Create field for editing or display
  // ═══════════════════════════════════════════════════════════════════════
  const createField = (
    label: string,
    value: any,
    type?: 'text' | 'number' | 'date' | 'boolean' | 'array',
    onChange?: (val: any) => void
  ): FieldConfig => ({
    label,
    value,
    type,
    onChange,
  });

  // ═══════════════════════════════════════════════════════════════════════
  // BUILD TIMELINE FIELDS LIST
  // ═══════════════════════════════════════════════════════════════════════
  const allFields: FieldConfig[] = [];

  // Close of Escrow
  const closingFormatted = formatDateWithSource(data.closingDate, 'closingDays', 'calendar_days');
  if (closingFormatted || isEditing) {
    allFields.push(
      createField(
        "Close of Escrow",
        isEditing ? data.closingDate : closingFormatted?.display,
        'date',
        (val) => onDataChange?.({ ...data, closingDate: val })
      )
    );
  }

  // Initial Deposit / EMD Due
  const initialDepositFormatted = formatDateWithSource(data.initialDepositDueDate, 'initialDepositDays', 'business_days');
  if (initialDepositFormatted || isEditing) {
    allFields.push(
      createField(
        "Initial Deposit / EMD Due",
        isEditing ? data.initialDepositDueDate : initialDepositFormatted?.display,
        'date',
        (val) => onDataChange?.({ ...data, initialDepositDueDate: val })
      )
    );
  }

  // Seller Delivery of Documents
  const sellerDeliveryFormatted = formatDateWithSource(data.sellerDeliveryOfDisclosuresDate, 'sellerDeliveryDays', 'calendar_days');
  if (sellerDeliveryFormatted || isEditing) {
    allFields.push(
      createField(
        "Seller Delivery of Documents",
        isEditing ? data.sellerDeliveryOfDisclosuresDate : sellerDeliveryFormatted?.display,
        'date',
        (val) => onDataChange?.({ ...data, sellerDeliveryOfDisclosuresDate: val })
      )
    );
  }

  // Inspection Contingency
  const inspectionFormatted = formatDateWithSource(cont?.inspectionDays, 'inspectionDays', 'calendar_days');
  if (inspectionFormatted || isEditing) {
    allFields.push(
      createField(
        "Inspection Contingency",
        isEditing
          ? (typeof cont?.inspectionDays === 'string' ? cont.inspectionDays : null)
          : inspectionFormatted?.display,
        'date',
        (val) => onDataChange?.({
          ...data,
          contingencies: { ...cont, inspectionDays: val },
        })
      )
    );
  }

  // Appraisal Contingency
  const appraisalFormatted = formatDateWithSource(cont?.appraisalDays, 'appraisalDays', 'calendar_days');
  if (appraisalFormatted || isEditing) {
    allFields.push(
      createField(
        "Appraisal Contingency",
        isEditing
          ? (typeof cont?.appraisalDays === 'string' ? cont.appraisalDays : null)
          : appraisalFormatted?.display,
        'date',
        (val) => onDataChange?.({
          ...data,
          contingencies: { ...cont, appraisalDays: val },
        })
      )
    );
  }

  // Loan Contingency
  const loanFormatted = formatDateWithSource(cont?.loanDays, 'loanDays', 'calendar_days');
  if (loanFormatted || isEditing) {
    allFields.push(
      createField(
        "Loan Contingency",
        isEditing
          ? (typeof cont?.loanDays === 'string' ? cont.loanDays : null)
          : loanFormatted?.display,
        'date',
        (val) => onDataChange?.({
          ...data,
          contingencies: { ...cont, loanDays: val },
        })
      )
    );
  }

  // Sale of Buyer Property Contingency (boolean, different format)
  if (cont?.saleOfBuyerProperty !== undefined || isEditing) {
    const copValue = isEditing ? cont?.saleOfBuyerProperty : (cont?.saleOfBuyerProperty ? "Active" : "Waived");
    allFields.push(
      createField(
        "Sale of Buyer Property Contingency",
        copValue,
        'boolean',
        (val) => onDataChange?.({
          ...data,
          contingencies: { ...cont, saleOfBuyerProperty: val },
        })
      )
    );
  }

  // Filter out null values when not editing
  const fields = isEditing ? allFields : allFields.filter((f) => f.value !== null);

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
