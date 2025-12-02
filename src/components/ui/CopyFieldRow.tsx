// src/components/ui/CopyFieldRow.tsx
"use client";

import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { toast } from "sonner";

export function CopyFieldRow({ label, value }: { label: string; value: string }) {
  const copy = () => {
    navigator.clipboard.writeText(value);
    toast.success(`Copied ${label}`);
  };

  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0">
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">{value || "-"}</p>
      </div>
      <Button variant="ghost" size="sm" onClick={copy}>
        <Copy className="h-4 w-4" />
      </Button>
    </div>
  );
}