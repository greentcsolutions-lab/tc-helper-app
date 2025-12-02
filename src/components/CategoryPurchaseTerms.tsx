// src/components/CategoryPurchaseTerms.tsx
import CategorySection from "./CategorySection";
import { DollarSign } from "lucide-react";

export default function CategoryPurchaseTerms({ data }: { data: Record<string, any> }) {
  const deposit = data.initial_deposit || {};
  const homeWarranty = data.home_warranty || {};

  const fields = [
    {
      label: "Buyer Names",
      value: Array.isArray(data.buyer_names)
        ? data.buyer_names.join(" & ")
        : data.buyer_names || "Not Found",
    },
    {
      label: "Property Address",
      value: data.property_address?.full || "Not Found",
    },
    {
      label: "Purchase Price",
      value: data.purchase_price || "Not Found",
    },
    {
      label: "All Cash Offer",
      value: data.all_cash === true ? "Yes" : data.all_cash === false ? "No" : "Not Specified",
    },
    {
      label: "Initial Deposit Amount",
      value: deposit.amount || "Not Found",
    },
    {
      label: "Loan Type",
      value: data.loan_type || "Not Specified",
    },
    {
      label: "Seller Credit to Buyer",
      value: data.seller_credit_to_buyer || "None",
    },
    {
      label: "Counters & Addenda Summary",
      value: data.counters_and_addenda_summary || "No counters or addenda",
    },
    {
      label: "Home Warranty Ordered By",
      value: homeWarranty.ordered_by || "Not Specified",
    },
    {
      label: "Seller Max Warranty Cost",
      value: homeWarranty.seller_max_cost || "Not Specified",
    },
  ];

  return (
    <CategorySection
      title="Purchase Terms & Costs"
      icon={<DollarSign className="h-6 w-6 text-green-600" />}
      fields={fields}
      categoryName="Purchase Terms"
      defaultOpen={true}
    />
  );
}