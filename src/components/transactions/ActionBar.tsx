// src/components/transactions/ActionBar.tsx
"use client";

import { Button } from "@/components/ui/button";
import { Archive, Trash2, X } from "lucide-react";

interface ActionBarProps {
  selectedCount: number;
  onArchive: () => void;
  onDelete: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function ActionBar({
  selectedCount,
  onArchive,
  onDelete,
  onCancel,
  isLoading = false
}: ActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg z-50 animate-in slide-in-from-bottom-5 duration-300">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="font-semibold text-lg">
              {selectedCount} Selected
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="default"
              onClick={onArchive}
              disabled={isLoading}
              className="gap-2"
            >
              <Archive className="h-4 w-4" />
              Archive
            </Button>

            <Button
              variant="destructive"
              size="default"
              onClick={onDelete}
              disabled={isLoading}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={onCancel}
              disabled={isLoading}
              className="rounded-full"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
