// src/components/CategoryRepresentingParties.tsx
// Version: 3.0.0 - 2026-01-03
// ENHANCED: Added edit mode support and detailed agent fields (phone, email)
// FIXED: Proper null handling with type guards

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

  // ═══════════════════════════════════════════════════════════════════════
  // HELPER: Safe string display
  // ═══════════════════════════════════════════════════════════════════════
  const formatString = (value: string | null | undefined): string | null => {
    if (typeof value !== 'string' || value.trim() === '') return null;
    return value;
  };

  // ═══════════════════════════════════════════════════════════════════════
  // BUILD FIELD LIST WITH TYPE-SAFE GUARDS AND EDIT SUPPORT
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

  const allFields: FieldConfig[] = [
    // Listing Agent
    createField(
      "Listing Agent",
      isEditing
        ? (brokers?.listingAgentDetails?.name || brokers?.listingAgent)
        : formatString(brokers?.listingAgentDetails?.name || brokers?.listingAgent),
      'text',
      (val) => {
        const updatedBrokers = {
          ...brokers,
          listingAgent: val,
          listingAgentDetails: {
            ...brokers?.listingAgentDetails,
            name: val,
          },
        };
        onDataChange?.({ ...data, brokers: updatedBrokers });
      }
    ),
    createField(
      "Listing Brokerage",
      isEditing
        ? (brokers?.listingAgentDetails?.company || brokers?.listingBrokerage)
        : formatString(brokers?.listingAgentDetails?.company || brokers?.listingBrokerage),
      'text',
      (val) => {
        const updatedBrokers = {
          ...brokers,
          listingBrokerage: val,
          listingAgentDetails: {
            ...brokers?.listingAgentDetails,
            company: val,
          },
        };
        onDataChange?.({ ...data, brokers: updatedBrokers });
      }
    ),
    createField(
      "Listing Agent Phone",
      isEditing
        ? brokers?.listingAgentDetails?.phone
        : formatString(brokers?.listingAgentDetails?.phone),
      'text',
      (val) => {
        const updatedBrokers = {
          ...brokers,
          listingAgentDetails: {
            ...brokers?.listingAgentDetails,
            phone: val,
          },
        };
        onDataChange?.({ ...data, brokers: updatedBrokers });
      }
    ),
    createField(
      "Listing Agent Email",
      isEditing
        ? brokers?.listingAgentDetails?.email
        : formatString(brokers?.listingAgentDetails?.email),
      'text',
      (val) => {
        const updatedBrokers = {
          ...brokers,
          listingAgentDetails: {
            ...brokers?.listingAgentDetails,
            email: val,
          },
        };
        onDataChange?.({ ...data, brokers: updatedBrokers });
      }
    ),

    // Selling/Buyer's Agent
    createField(
      "Selling Agent",
      isEditing
        ? (brokers?.buyersAgentDetails?.name || brokers?.sellingAgent)
        : formatString(brokers?.buyersAgentDetails?.name || brokers?.sellingAgent),
      'text',
      (val) => {
        const updatedBrokers = {
          ...brokers,
          sellingAgent: val,
          buyersAgentDetails: {
            ...brokers?.buyersAgentDetails,
            name: val,
          },
        };
        onDataChange?.({ ...data, brokers: updatedBrokers });
      }
    ),
    createField(
      "Selling Brokerage",
      isEditing
        ? (brokers?.buyersAgentDetails?.company || brokers?.sellingBrokerage)
        : formatString(brokers?.buyersAgentDetails?.company || brokers?.sellingBrokerage),
      'text',
      (val) => {
        const updatedBrokers = {
          ...brokers,
          sellingBrokerage: val,
          buyersAgentDetails: {
            ...brokers?.buyersAgentDetails,
            company: val,
          },
        };
        onDataChange?.({ ...data, brokers: updatedBrokers });
      }
    ),
    createField(
      "Selling Agent Phone",
      isEditing
        ? brokers?.buyersAgentDetails?.phone
        : formatString(brokers?.buyersAgentDetails?.phone),
      'text',
      (val) => {
        const updatedBrokers = {
          ...brokers,
          buyersAgentDetails: {
            ...brokers?.buyersAgentDetails,
            phone: val,
          },
        };
        onDataChange?.({ ...data, brokers: updatedBrokers });
      }
    ),
    createField(
      "Selling Agent Email",
      isEditing
        ? brokers?.buyersAgentDetails?.email
        : formatString(brokers?.buyersAgentDetails?.email),
      'text',
      (val) => {
        const updatedBrokers = {
          ...brokers,
          buyersAgentDetails: {
            ...brokers?.buyersAgentDetails,
            email: val,
          },
        };
        onDataChange?.({ ...data, brokers: updatedBrokers });
      }
    ),
  ];

  // Filter out null values when not editing
  const fields = isEditing ? allFields : allFields.filter((f) => f.value !== null);

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
