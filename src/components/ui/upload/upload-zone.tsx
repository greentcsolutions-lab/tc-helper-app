// src/components/ui/upload/upload-zone.tsx
// Version: 6.0.0 - 2026-01-24
// NEW: SSE streaming with real-time progress updates

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";

import { UploadView } from "./types";
import { Dropzone } from "./dropzone";
import { ProcessingView } from "./processing-view";
import { ResultsView } from "./results-view";
import { useFileUpload } from "@/hooks/useFileUpload";
import { useExtractionStream } from "@/hooks/useExtractionStream";
import { useCleanupEffects } from "@/hooks/useCleanupEffects";
import { useUploadLayout } from "./upload-layout";
import { Button } from "@/components/ui/button";
import { FileEdit } from "lucide-react";

export default function UploadZone() {
  const [view, setView] = useState<UploadView>("idle");
  const [extractedData, setExtractedData] = useState<any>(null);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [needsReview, setNeedsReview] = useState(false);

  const router = useRouter();
  const { currentFile, parseId, handleFile, resetUpload } = useFileUpload();
  const { setIsProcessing } = useUploadLayout();

  // SSE streaming hook - only enabled when processing
  const { progress, isComplete, error } = useExtractionStream(
    parseId,
    view === "processing"
  );

  // Setup cleanup effects
  useCleanupEffects({ parseId, view });

  // Handle stream completion
  useEffect(() => {
    if (!isComplete) return;

    console.log("[upload-zone] Extraction complete, loading results");
    setNeedsReview(progress.needsReview || false);
    loadExtractionResults(parseId);
    setView("done");
    setIsProcessing(false); // Allow sidebar to slide back in (though we'll show results fullscreen)
  }, [isComplete, parseId, progress.needsReview, setIsProcessing]);

  // Handle stream errors
  useEffect(() => {
    if (!error) return;

    toast.error("Extraction failed", { description: error });
    setView("idle");
    setIsProcessing(false); // Reset processing state
    resetUpload();
  }, [error, resetUpload, setIsProcessing]);

  const onFileSelect = async (file: File) => {
    setView("uploading");

    const newParseId = await handleFile(file);
    if (!newParseId) {
      setView("idle");
      return;
    }

    console.log("[upload-zone] Upload complete, starting SSE stream:", newParseId);

    // Switch to processing view - this will trigger the SSE stream via useExtractionStream
    setView("processing");
    setIsProcessing(true); // Trigger sidebar slide-out
  };

  const loadExtractionResults = async (parseId: string) => {
    try {
      console.log("[upload-zone] Loading extraction results");

      const finalizeRes = await fetch(`/api/parse/finalize/${parseId}`);

      if (finalizeRes.ok) {
        const { data } = await finalizeRes.json();

        setExtractedData({
          buyerNames: data.buyerNames || [],
          sellerNames: data.sellerNames || [],
          propertyAddress: data.propertyAddress || "",
          purchasePrice: data.purchasePrice || 0,
          earnestMoneyDeposit: data.earnestMoneyDeposit || { amount: null, holder: null },
          closingDate: data.closingDate || null,
          financing: data.financing || { isAllCash: true, loanType: null, loanAmount: null },
          contingencies: data.contingencies || {},
          closingCosts: data.closingCosts || {},
          brokers: data.brokers || {},
          personalPropertyIncluded: data.personalPropertyIncluded || [],
          effectiveDate: data.effectiveDate || null,
          escrowHolder: data.escrowHolder || null,
          timelineDataStructured: data.timelineDataStructured || null,
        });

        console.log("[upload-zone] ✓ Results loaded");
      }
    } catch (error) {
      console.error("[upload-zone] Failed to load extraction results:", error);
    }
  };

  const handleComplete = async () => {
    if (!parseId) {
      router.push("/transactions");
      return;
    }

    setIsCleaningUp(true);
    console.log('[upload-zone] 🧹 Cleaning up and navigating to transactions');

    try {
      await fetch(`/api/parse/cleanup/${parseId}`, { method: "POST" });
      console.log('[upload-zone] ✓ Cleanup complete');
    } catch (error) {
      console.warn('[upload-zone] Cleanup failed but continuing:', error);
    }

    router.push("/transactions");
  };

  const handleCancel = () => {
    resetUpload();
  };

  return (
    <div
      className={`
        max-w-6xl mx-auto space-y-8 transition-all duration-500 ease-in-out
        ${view === "processing" ? "upload-zone-centered" : ""}
      `}
    >
      {/* Upload screen */}
      {view === "idle" && (
        <>
          <Dropzone
            isUploading={false}
            currentFile={currentFile}
            onFileSelect={onFileSelect}
            onCancel={handleCancel}
          />

          {/* Manual Entry Option */}
          <div className="text-center space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1 border-t border-gray-300" />
              <span className="text-sm font-medium text-muted-foreground">OR</span>
              <div className="flex-1 border-t border-gray-300" />
            </div>

            <Button asChild variant="outline" size="lg" className="w-full max-w-md">
              <Link href="/upload/manual">
                <FileEdit className="h-4 w-4 mr-2" />
                Create Transaction Manually
              </Link>
            </Button>

            <p className="text-sm text-muted-foreground">
              Don't have documents? Enter transaction details manually.
            </p>
          </div>

          <PrivacyNotice />
        </>
      )}

      {/* Uploading screen */}
      {view === "uploading" && (
        <>
          <Dropzone
            isUploading={true}
            currentFile={currentFile}
            onFileSelect={onFileSelect}
            onCancel={handleCancel}
            liveText="Uploading your document..."
          />
          <PrivacyNotice />
        </>
      )}

      {/* Processing screen - connected to SSE stream */}
      {view === "processing" && (
        <ProcessingView progress={progress} />
      )}

      {/* Results screen */}
      {view === "done" && (
        <ResultsView
          parseId={parseId}
          needsReview={needsReview}
          extractedData={extractedData}
          isCleaningUp={isCleaningUp}
          onComplete={handleComplete}
        />
      )}
    </div>
  );
}

function PrivacyNotice() {
  return (
    <div className="text-center px-4">
      <p className="text-sm text-muted-foreground max-w-2xl mx-auto leading-relaxed">
        By uploading, you agree to secure processing via trusted providers.
        All images are <span className="font-medium">automatically deleted after confirmation</span>.
        We never sell or share your data.
      </p>
      <p className="mt-3">
        <a
          href="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-primary hover:underline"
        >
          California Privacy Rights (CCPA/CPRA) • Full Policy →
        </a>
      </p>
    </div>
  );
}