// src/components/CategoryTimelineContingencies.tsx
// Version: 1.0.0-initial - 2025-12-24
import CategorySection from "./CategorySection";
import { Calendar } from "lucide-react";
import { ParseResult } from "@/types/parse";

export default function CategoryTimelineContingencies({
  data,
}: {
  data: ParseResult;
}) {
  const cont = data.extractionDetails?.contingencies;

  const fields = [
    { label: "Close of Escrow", value: data.closingDate },
    {
      label: "Inspection Contingency",
      value: cont?.inspectionDays
        ? `${cont.inspectionDays} days`
        : null,
    },
    {
      label: "Appraisal Contingency",
      value: cont?.appraisalDays
        ? `${cont.appraisalDays} days`
        : null,
    },
    {
      label: "Loan Contingency",
      value: cont?.loanDays ? `${cont.loanDays} days` : null,
    },
    {
      label: "COP Contingency",
      value:
        cont?.copContingency !== undefined
          ? cont.copContingency
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