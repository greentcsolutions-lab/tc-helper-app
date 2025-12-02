import CategorySection from "./CategorySection";
import { Calendar } from "lucide-react";

export default function CategoryTimelineContingencies({ data }: { data: Record<string, any> }) {
  const fields = [
    { label: "COP Contingency", value: data.cop_contingency ? "Active" : "Waived" },
    { label: "Final Acceptance Date", value: data.final_acceptance_date },
    { label: "Initial Deposit Due", value: data.initial_deposit?.due },
    { label: "Seller Delivery of Documents", value: `${data.seller_delivery_of_documents_days || 7} days after acceptance` },
    { label: "CR-B Attached & Signed", value: data.crb_attached_and_signed ? "Yes" : "No" },
    { label: "Inspection Contingency", value: data.inspection_contingency ? "Active" : "Waived" },
    { label: "Appraisal Contingency", value: data.appraisal_contingency ? "Active" : "Waived" },
    { label: "Loan Contingency", value: data.loan_contingency ? "Active" : "Waived" },
    { label: "Close of Escrow", value: data.close_of_escrow },
  ].filter(f => f.value !== undefined);

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