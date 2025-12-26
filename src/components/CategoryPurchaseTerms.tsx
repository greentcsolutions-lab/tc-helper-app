// src/components/CategoryPurchaseTerms.tsx
// Updated to use enriched ParseResult direct fields (no extractionDetails)

import CategorySection from "./CategorySection";
import { DollarSign } from "lucide-react";
import { ParseResult } from "@/types";

export default function CategoryPurchaseTerms({ data }: { data: ParseResult }) {
  const fields = [
    {
      label: "Buyer Names",
      value: data.buyerNames?.length ? data.buyerNames.join(" & ") : null,
    },
    {
      label: "Seller Names",
      value: data.sellerNames?.length ? data.sellerNames.join(" & ") : null,
    },
    { label: "Property Address", value: data.propertyAddress },
    {
      label: "Purchase Price",
      value: data.purchasePrice ? `$${data.purchasePrice.toLocaleString()}` : null,
    },
    {
      label: "All Cash Offer",
      value: data.isAllCash !== null ? (data.isAllCash ? "Yes" : "No") : null,
    },
    {
      label: "Initial Deposit Amount",
      value: data.earnestMoneyDeposit?.amount
        ? `$${data.earnestMoneyDeposit.amount.toLocaleString()}`
        : null,
    },
    { label: "Deposit Holder", value: data.earnestMoneyDeposit?.holder },
    { label: "Loan Type", value: data.loanType },
    { label: "Close of Escrow", value: data.closingDate },
    { label: "Effective Date", value: data.effectiveDate },
    {
      label: "Seller Credit to Buyer",
      value: data.closingCosts?.sellerCreditAmount
        ? `$${data.closingCosts.sellerCreditAmount.toLocaleString()}`
        : null,
    },
  ].filter((f) => f.value !== null && f.value !== undefined);

  if (fields.length === 0) return null;

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