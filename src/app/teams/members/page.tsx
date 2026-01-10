import { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Team Members | TC Helper",
  description: "Manage your team members",
};

export default function TeamMembersPage() {
  // For now, redirect to team settings where members will be managed
  redirect("/teams/settings");
}
