// src/components/ui/upload/results-view.tsx
// Version: 2.0.0 - 2026-01-24
// Two-column layout with glass effect footer

"use client";

import { CheckCircle, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="min-h-screen pb-32">
      {/* Success Banner */}
      <div className="mb-8 text-center space-y-3">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 mb-4">
          <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
        </div>
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100">
          {needsReview ? "Extraction Complete" : "All Set!"}
        </h2>
        <p className="text-gray-600 dark:text-gray-400 max-w-lg mx-auto">
          {needsReview
            ? "Review the extracted information below. Some fields may need your attention."
            : "Your contract has been successfully processed. Review the details below."}
        </p>
      </div>

      {/* Two-Column Layout */}
      {extractedData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 max-w-7xl mx-auto px-4">
          {/* Left Column: Contract Terms */}
          <Card className="h-fit">
            <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
              <CardTitle className="text-xl font-semibold">Contract Terms</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <ExtractionCategories data={extractedData} viewContext="left" />
            </CardContent>
          </Card>

          {/* Right Column: Timeline & Parties */}
          <Card className="h-fit">
            <CardHeader className="border-b bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20">
              <CardTitle className="text-xl font-semibold">Timeline & Parties</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <ExtractionCategories data={extractedData} viewContext="right" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Glass Effect Footer */}
      <div className="fixed bottom-0 left-0 right-0 z-50">
        <div className="backdrop-blur-xl bg-white/70 dark:bg-gray-950/70 border-t border-gray-200/50 dark:border-gray-800/50 shadow-2xl">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-center sm:text-left">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Ready to continue?
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {needsReview
                    ? "Review and edit details in your dashboard"
                    : "View this transaction in your dashboard"}
                </p>
              </div>

              <Button
                size="lg"
                onClick={onComplete}
                disabled={isCleaningUp}
                className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50"
              >
                {isCleaningUp ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Finalizing...
                  </>
                ) : (
                  <>
                    Continue to Dashboard
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}