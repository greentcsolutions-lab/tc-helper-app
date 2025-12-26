// src/components/CategoryRepresentingParties.tsx
// Updated to use direct brokers field from enriched ParseResult

import CategorySection from "./CategorySection";
import { Users } from "lucide-react";
import { ParseResult } from "@/types";

export default function CategoryRepresentingParties({
  data,
}: {
  data: ParseResult;
}) {
  const brokers = data.brokers;

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