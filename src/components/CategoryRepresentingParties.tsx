// src/components/CategoryRepresentingParties.tsx
// Version: 1.0.0-initial - 2025-12-24
import CategorySection from "./CategorySection";
import { Users } from "lucide-react";
import { ParseResult } from "@/types/parse";

export default function CategoryRepresentingParties({
  data,
}: {
  data: ParseResult;
}) {
  const brokers = data.extractionDetails?.brokers;

  const fields = [
    { label: "Listing Brokerage", value: brokers?.listingBrokerage },
    { label: "Listing Agent", value: brokers?.listingAgent },
    { label: "Selling Brokerage", value: brokers?.sellingBrokerage },
    { label: "Selling Agent", value: brokers?.sellingAgent },
  ].filter((f) => f.value);

  if (fields.length === 0) return null;

  return (
    <CategorySection
      title="Representing Parties"
      icon={<Users className="h-6 w-6 text-indigo-600" />}
      fields={fields}
      categoryName="Representing Parties"
      defaultOpen={true}
    />
  );
}