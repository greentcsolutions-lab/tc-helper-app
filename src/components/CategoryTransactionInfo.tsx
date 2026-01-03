// src/components/CategoryTransactionInfo.tsx
// Version: 1.0.0 - 2026-01-03
// Transaction metadata and info

import CategorySection, { FieldConfig } from "./CategorySection";
import { FileText } from "lucide-react";
import { ParseResult } from "@/types";

interface CategoryTransactionInfoProps {
  data: ParseResult;
  isEditing?: boolean;
  onDataChange?: (updatedData: ParseResult) => void;
}

export default function CategoryTransactionInfo({
  data,
  isEditing = false,
  onDataChange,
}: CategoryTransactionInfoProps) {
  const createField = (
    label: string,
    value: any,
    type?: 'text' | 'number' | 'date' | 'boolean' | 'select' | 'array',
    options?: { label: string; value: string; disabled?: boolean }[],
    onChange?: (val: any) => void
  ): FieldConfig => ({
    label,
    value,
    type,
    options,
    onChange,
  });

  const formatType = (type: string | null) => {
    if (!type) return "Escrow";
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  const allFields: FieldConfig[] = [
    createField(
      "Transaction Type",
      isEditing ? data.transactionType || 'escrow' : formatType(data.transactionType),
      'select',
      [
        { label: 'Escrow', value: 'escrow' },
        { label: 'Listing', value: 'listing', disabled: true }, // Grayed out as requested
      ],
      (val) => onDataChange?.({ ...data, transactionType: val })
    ),
    createField(
      "File Name",
      data.fileName,
      'text'
    ),
  ];

  const fields = allFields;

  if (fields.length === 0) return null;

  return (
    <CategorySection
      title="Transaction Information"
      icon={<FileText className="h-6 w-6 text-purple-600" />}
      fields={fields}
      categoryName="Transaction Info"
      defaultOpen={true}
      isEditing={isEditing}
    />
  );
}
