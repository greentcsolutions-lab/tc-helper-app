// src/components/ui/CopyFieldRow.tsx
"use client";

import { Button } from "@/components/ui/button";
import { Copy, CheckCircle } from "lucide-react";
import { toast } from "sonner";

function CopyFieldRow({ label, value, isCompleted }: { label: string; value: string; isCompleted?: boolean }) {
  const copy = () => {
    navigator.clipboard.writeText(value);
    toast.success(`Copied ${label}`);
  };

  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p className="font-medium">{label}</p>
          {isCompleted && (
            <span className="flex items-center gap-1 text-green-600">
              <CheckCircle className="h-4 w-4" />
              <span className="text-xs font-medium">Complete</span>
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{value || "-"}</p>
      </div>
      <Button variant="ghost" size="sm" onClick={copy}>
        <Copy className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default CopyFieldRow;  // ← Default export