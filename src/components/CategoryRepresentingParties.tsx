import CategorySection from "./CategorySection";
import { Users } from "lucide-react";

function formatAgent(agent: any) {
  if (!agent) return "Not Provided";
  const parts = [];
  if (agent.agent_name_1) parts.push(agent.agent_name_1);
  if (agent.email) parts.push(agent.email);
  if (agent.phone) parts.push(agent.phone);
  return parts.join(" • ") || "Not Provided";
}

export default function CategoryRepresentingParties({ data }: { data: any }) {
  const fields = [
    { label: "Buyer's Brokerage", value: data.buyers_broker?.brokerage_name },
    { label: "Buyer's Agent", value: formatAgent(data.buyers_broker) },
    { label: "Seller's Brokerage", value: data.sellers_broker?.brokerage_name },
    { label: "Listing Agent", value: formatAgent(data.sellers_broker) },
  ].filter(f => f.value);

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