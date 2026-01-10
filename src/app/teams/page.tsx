import { Metadata } from "next";
import { TeamsPlaceholder } from "@/components/teams/TeamsPlaceholder";

export const metadata: Metadata = {
  title: "Teams | TC Helper",
  description: "Collaborate with your team on transactions",
};

export default function TeamsPage() {
  return <TeamsPlaceholder />;
}
