// src/components/CategoryRepresentingParties.tsx
// Version: 3.2.0 - 2026-01-05
// FIXED: Works with current ParseResult using listingAgentDetails / buyersAgentDetails
//         Falls back to legacy flat fields for backward compatibility
//         Full support for editing mode

import CategorySection, { FieldConfig } from "./CategorySection";
import { Users } from "lucide-react";
import { ParseResult } from "@/types";

interface CategoryRepresentingPartiesProps {
  data: ParseResult;
  isEditing?: boolean;
  onDataChange?: (updatedData: ParseResult) => void;
}

export default function CategoryRepresentingParties({
  data,
  isEditing = false,
  onDataChange,
}: CategoryRepresentingPartiesProps) {
  const brokers = data.brokers;

  const formatString = (value: string | null | undefined): string | null => {
    return value && value.trim() !== '' ? value.trim() : null;
  };

  const createField = (
    label: string,
    value: any,
    type: 'text' = 'text',
    onChange?: (val: string) => void
  ): FieldConfig => ({
    label,
    value: isEditing ? value ?? '' : formatString(value),
    type,
    onChange,
  });

  const fields: FieldConfig[] = [];

  // === LISTING AGENT SECTION ===
  const listingName = brokers?.listingAgentDetails?.name || brokers?.listingAgent || null;
  const listingCompany = brokers?.listingAgentDetails?.company || brokers?.listingBrokerage || null;
  const listingEmail = brokers?.listingAgentDetails?.email || null;
  const listingPhone = brokers?.listingAgentDetails?.phone || null;

  if (listingName || listingCompany || listingEmail || listingPhone || isEditing) {
    fields.push(
      createField("Listing Agent", listingName, 'text', (val) =>
        onDataChange?.({
          ...data,
          brokers: {
            ...brokers!,
            listingAgent: val,
            listingAgentDetails: { ...brokers?.listingAgentDetails!, name: val },
          },
        })
      ),
      createField("Listing Brokerage", listingCompany, 'text', (val) =>
        onDataChange?.({
          ...data,
          brokers: {
            ...brokers!,
            listingBrokerage: val,
            listingAgentDetails: { ...brokers?.listingAgentDetails!, company: val },
          },
        })
      ),
      createField("Listing Agent Email", listingEmail, 'text', (val) =>
        onDataChange?.({
          ...data,
          brokers: {
            ...brokers!,
            listingAgentDetails: { ...brokers?.listingAgentDetails!, email: val },
          },
        })
      ),
      createField("Listing Agent Phone", listingPhone, 'text', (val) =>
        onDataChange?.({
          ...data,
          brokers: {
            ...brokers!,
            listingAgentDetails: { ...brokers?.listingAgentDetails!, phone: val },
          },
        })
      )
    );
  }

  // === SELLING AGENT SECTION ===
  const sellingName = brokers?.buyersAgentDetails?.name || brokers?.sellingAgent || null;
  const sellingCompany = brokers?.buyersAgentDetails?.company || brokers?.sellingBrokerage || null;
  const sellingEmail = brokers?.buyersAgentDetails?.email || null;
  const sellingPhone = brokers?.buyersAgentDetails?.phone || null;

  if (sellingName || sellingCompany || sellingEmail || sellingPhone || isEditing) {
    fields.push(
      createField("Selling Agent", sellingName, 'text', (val) =>
        onDataChange?.({
          ...data,
          brokers: {
            ...brokers!,
            sellingAgent: val,
            buyersAgentDetails: { ...brokers?.buyersAgentDetails!, name: val },
          },
        })
      ),
      createField("Selling Brokerage", sellingCompany, 'text', (val) =>
        onDataChange?.({
          ...data,
          brokers: {
            ...brokers!,
            sellingBrokerage: val,
            buyersAgentDetails: { ...brokers?.buyersAgentDetails!, company: val },
          },
        })
      ),
      createField("Selling Agent Email", sellingEmail, 'text', (val) =>
        onDataChange?.({
          ...data,
          brokers: {
            ...brokers!,
            buyersAgentDetails: { ...brokers?.buyersAgentDetails!, email: val },
          },
        })
      ),
      createField("Selling Agent Phone", sellingPhone, 'text', (val) =>
        onDataChange?.({
          ...data,
          brokers: {
            ...brokers!,
            buyersAgentDetails: { ...brokers?.buyersAgentDetails!, phone: val },
          },
        })
      )
    );
  }

  if (fields.length === 0) return null;

  return (
    <CategorySection
      title="Representing Parties"
      icon={<Users className="h-6 w-6 text-indigo-600" />}
      fields={fields}
      categoryName="Representing Parties"
      defaultOpen={true}
      isEditing={isEditing}
    />
  );
}