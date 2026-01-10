// src/components/settings/PreferencesSettings.tsx
"use client";

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { SlidersHorizontal } from "lucide-react";

export default function PreferencesSettings() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Preferences</CardTitle>
        <CardDescription>Customize your app experience</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8 text-muted-foreground">
          <SlidersHorizontal className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Preferences settings coming soon!</p>
          <p className="text-sm mt-2">This section will include notification settings, theme preferences, and more.</p>
        </div>
      </CardContent>
    </Card>
  );
}
