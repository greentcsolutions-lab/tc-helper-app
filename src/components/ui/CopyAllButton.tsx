// src/components/ui/CopyAllButton.tsx
"use client";

import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { toast } from "sonner";

interface CopyAllButtonProps {
  data: Record<string, any>;
  categoryName?: string;
}

export default function CopyAllButton({ data, categoryName }: CopyAllButtonProps) {
  const copyAll = () => {
    const text = Object.entries(data)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");
    navigator.clipboard.writeText(text);
    toast.success(categoryName ? `Copied ${categoryName}!` : "Copied all fields!");
  };

  return (
    <Button variant="outline" size="sm" onClick={copyAll}>
      <Copy className="h-4 w-4 mr-2" />
      Copy All
    </Button>
  );
}