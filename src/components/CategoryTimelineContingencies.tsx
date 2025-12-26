// src/components/CategoryTimelineContingencies.tsx
// Updated to use direct contingencies field from enriched ParseResult

import CategorySection from "./CategorySection";
import { Calendar } from "lucide-react";
import { ParseResult } from "@/types";

export default function CategoryTimelineContingencies({
  data,
}: {
  data: ParseResult;
}) {
  const cont = data.contingencies;

  const fields = [
    { label: "Close of Escrow", value: data.closingDate },
    {
      label: "Inspection Contingency",
      value: cont?.inspectionDays
        ? typeof cont.inspectionDays === "string"
          ? cont.inspectionDays
          : `${cont.inspectionDays} days`
        : null,
    },
    {
      label: "Appraisal Contingency",
      value: cont?.appraisalDays
        ? typeof cont.appraisalDays === "string"
          ? cont.appraisalDays
          : `${cont.appraisalDays} days`
        : null,
    },
    {
      label: "Loan Contingency",
      value: cont?.loanDays
        ? typeof cont.loanDays === "string"
          ? cont.loanDays
          : `${cont.loanDays} days`
        : null,
    },
    {
      label: "Sale of Buyer Property Contingency",
      value: cont?.saleOfBuyerProperty !== undefined
        ? cont.saleOfBuyerProperty
          ? "Active"
          : "Waived"
        : null,
    },
  ].filter((f) => f.value !== null && f.value !== undefined);

  if (fields.length === 0) return null;

  return (
    <CategorySection
      title="Timeline & Contingencies"
      icon={<Calendar className="h-6 w-6 text-blue-600" />}
      fields={fields}
      categoryName="Timeline"
      defaultOpen={true}
    />
  );
}