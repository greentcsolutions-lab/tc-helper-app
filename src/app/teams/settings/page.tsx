import { Metadata } from "next";
import { TeamSettingsPlaceholder } from "@/components/teams/TeamSettingsPlaceholder";

export const metadata: Metadata = {
  title: "Team Settings | TC Helper",
  description: "Manage your team settings and members",
};

export default function TeamSettingsPage() {
  return <TeamSettingsPlaceholder />;
}
