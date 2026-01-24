// src/components/ui/upload/processing-view.tsx
// Version: 2.0.0 - 2026-01-24
// Displays real-time extraction progress with SSE stream

"use client";

import { ExtractionProgress } from "@/hooks/useExtractionStream";

type ProcessingViewProps = {
  progress: ExtractionProgress;
};

export function ProcessingView({ progress }: ProcessingViewProps) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center space-y-6 max-w-md mx-auto px-4">
        {/* Spinner */}
        <div className="relative w-16 h-16 mx-auto">
          <div className="absolute inset-0 rounded-full border-4 border-blue-200/30" />
          <div className="absolute inset-0 rounded-full border-4 border-t-blue-600 border-r-blue-600 border-b-transparent border-l-transparent animate-spin" />
        </div>

        {/* Message */}
        <div className="space-y-2">
          <p className="text-2xl md:text-3xl font-semibold text-gray-900 dark:text-gray-100 animate-fade-in">
            {progress.message}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
            {progress.phase === "complete" ? "Done" : progress.phase}
          </p>
        </div>
      </div>
    </div>
  );
}