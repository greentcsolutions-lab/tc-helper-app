// src/components/ui/upload/processing-view.tsx
// Version: 1.0.0 - 2025-12-30
// Displays processing state with progress messages and jokes

"use client";

import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ParseState } from "@/hooks/useParseOrchestrator";

type ProcessingViewProps = {
  state: ParseState;
  currentJoke: string;
};

export function ProcessingView({ state, currentJoke }: ProcessingViewProps) {
  const getMessage = (): string => {
    if (state.message) {
      return state.message;
    }
    return currentJoke;
  };

  const getProgressDetails = (): string => {
    const parts: string[] = [];

    if (state.pageCount) {
      parts.push(`${state.pageCount} pages`);
    }

    if (state.criticalPageCount) {
      parts.push(`${state.criticalPageCount} critical`);
    }

    if (state.phase === 'extract') {
      parts.push('extracting data');
    }

    if (state.phase === 'cleanup') {
      parts.push('cleaning up');
    }

    return parts.length > 0 ? `(${parts.join(', ')})` : '';
  };

  return (
    <Card className="border-2">
      <CardContent className="p-12 text-center space-y-4">
        <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
        <div>
          <p className="text-lg font-medium">{getMessage()}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {getProgressDetails()}
          </p>
          {state.detectedForms && state.detectedForms.length > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              Detected: {state.detectedForms.join(", ")}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}