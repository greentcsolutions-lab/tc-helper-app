// src/components/ui/upload/results-view.tsx
// Version: 1.0.0 - 2025-12-30
// Displays extraction results with preview gallery

"use client";

import { CheckCircle, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PreviewGallery } from "./preview-gallery";
import ExtractionCategories from "@/components/ExtractionCategories";

type ResultsViewProps = {
  parseId: string;
  needsReview?: boolean;
  extractedData: any;
  isCleaningUp: boolean;
  onComplete: () => void;
};

export function ResultsView({
  parseId,
  needsReview,
  extractedData,
  isCleaningUp,
  onComplete,
}: ResultsViewProps) {
  return (
    <>
      <Card className="border-2 border-green-500/20 bg-green-50/50 dark:bg-green-950/20">
        <CardContent className="p-8 text-center space-y-4">
          <CheckCircle className="h-16 w-16 mx-auto text-green-600" />
          <div>
            <h3 className="text-2xl font-bold text-green-900 dark:text-green-100">
              {needsReview ? "Extraction Complete — Review Recommended" : "Success!"}
            </h3>
            <p className="text-green-700 dark:text-green-300 mt-2">
              {needsReview 
                ? "Some data fields had low confidence. Please review in the dashboard."
                : "Your transaction data has been extracted and saved."}
            </p>
          </div>
        </CardContent>
      </Card>

      {extractedData && (
        <Card>
          <CardContent className="p-8">
            <h3 className="text-xl font-bold mb-6">Extracted Data Preview</h3>
            <ExtractionCategories data={extractedData} />
          </CardContent>
        </Card>
      )}

      {parseId && (
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-center">
            Critical Pages Extracted (for debugging)
          </h3>
          <p className="text-sm text-center text-muted-foreground">
            These are the pages Grok analyzed to extract your transaction data.
          </p>
          <PreviewGallery parseId={parseId} />
        </div>
      )}

      <div className="flex justify-center pt-8">
        <Button
          size="lg"
          onClick={onComplete}
          disabled={isCleaningUp}
          className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:opacity-50"
        >
          {isCleaningUp ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Cleaning up...
            </>
          ) : (
            <>
              {needsReview ? "Review in Dashboard" : "Looks Good — Continue to Dashboard"}
              <ArrowRight className="ml-2 h-5 w-5" />
            </>
          )}
        </Button>
      </div>
    </>
  );
}