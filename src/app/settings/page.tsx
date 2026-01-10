// src/app/settings/page.tsx
"use client";

import { useState } from "react";
import { User, FileText, CreditCard, SlidersHorizontal, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import ProfileSettings from "@/components/settings/ProfileSettings";
import TaskTemplatesSettings from "@/components/settings/TaskTemplatesSettings";
import BillingSettings from "@/components/settings/BillingSettings";
import PreferencesSettings from "@/components/settings/PreferencesSettings";
import CalendarSyncSettings from "@/components/settings/CalendarSyncSettings";

type SettingsSection = "profile" | "templates" | "billing" | "calendar" | "preferences";

const settingsSections = [
  { id: "profile" as SettingsSection, name: "Profile", icon: User },
  { id: "templates" as SettingsSection, name: "Task Templates", icon: FileText },
  { id: "billing" as SettingsSection, name: "Billing & Plan", icon: CreditCard },
  { id: "calendar" as SettingsSection, name: "Calendar Sync", icon: Calendar },
  { id: "preferences" as SettingsSection, name: "Preferences", icon: SlidersHorizontal },
];

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingsSection>("profile");

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account settings and preferences</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Settings Sidebar */}
        <aside className="w-full md:w-64 shrink-0">
          <nav className="space-y-1">
            {settingsSections.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted text-muted-foreground"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{section.name}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Settings Content */}
        <main className="flex-1 min-w-0">
          {activeSection === "profile" && <ProfileSettings />}
          {activeSection === "templates" && <TaskTemplatesSettings />}
          {activeSection === "billing" && <BillingSettings />}
          {activeSection === "calendar" && <CalendarSyncSettings />}
          {activeSection === "preferences" && <PreferencesSettings />}
        </main>
      </div>
    </div>
  );
}
