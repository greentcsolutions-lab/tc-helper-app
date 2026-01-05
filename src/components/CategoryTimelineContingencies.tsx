// src/components/CategoryTimelineContingencies.tsx
// Version: 4.3.0 - 2026-01-05
// FIXED: Matches current ParseResult (no closeOfEscrowDate or calculated deadlines)
//         Displays raw contingency days and legacy closingDate
//         Full editing support

import CategorySection, { FieldConfig } from "./CategorySection";
import { Calendar } from "lucide-react";
import { ParseResult } from "@/types";

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
    fields.push(
      createField(
        "Close of Escrow",
        isEditing ? data.closingDate ?? '' : data.closingDate,
        'date',
        (val) => onDataChange?.({ ...data, closingDate: val })
      )
    );
  }

  // === Inspection Contingency ===
  if (cont?.inspectionDays != null || isEditing) {
    const display = cont?.inspectionDays != null 
      ? `${cont.inspectionDays} days` 
      : null;

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
    const display = cont?.appraisalDays != null 
      ? `${cont.appraisalDays} days` 
      : null;

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
    const display = cont?.loanDays != null 
      ? `${cont.loanDays} days` 
      : null;

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