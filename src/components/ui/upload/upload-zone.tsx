// src/components/ui/upload/upload-zone.tsx
// Version: 5.0.0 - 2025-12-30
// MAJOR REFACTOR: Separated concerns into smaller components and hooks
// Much cleaner, more maintainable, and easier to test

"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { UploadView } from "./types";
import { Dropzone } from "./dropzone";
import { ProcessingView } from "./processing-view";
import { ResultsView } from "./results-view";
import { useParseOrchestrator } from "@/hooks/useParseOrchestrator";
import { useFileUpload } from "@/hooks/useFileUpload";
import { useCleanupEffects } from "@/hooks/useCleanupEffects";

const JOKES = [
  "Don't trust AI to identify mushrooms...",
  "This is why we don't let Grok drive...",
  "Parsing legalese — the leading cause of AI therapy bills",
  "Fun fact: This PDF has more pages than my attention span",
  "Still faster than a human reading this packet",
  "Beep boop... processing state bureaucracy...",
  "Grok is now judging your buyer's handwriting",
  "Hang tight — we're teaching the AI to read realtor scribbles",
];

export default function UploadZone() {
  const [view, setView] = useState<UploadView>("idle");
  const [extractedData, setExtractedData] = useState<any>(null);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [jokeIndex, setJokeIndex] = useState(0);
  const lastActivity = useRef(Date.now());

  const router = useRouter();
  const { state: orchestratorState, runPipeline, triggerCleanup } = useParseOrchestrator();
  const { currentFile, parseId, handleFile, resetUpload } = useFileUpload();

  // Setup cleanup effects
  useCleanupEffects({ parseId, view });

  // Update view based on orchestrator state
  useEffect(() => {
    if (orchestratorState.phase === 'idle') return;

    if (orchestratorState.phase === 'error') {
      setView("idle");
      toast.error("Processing failed", { 
        description: orchestratorState.error || "An error occurred" 
      });
      return;
    }

    if (orchestratorState.phase === 'complete') {
      setView("done");
      return;
    }

    if (['render', 'classify', 'extract', 'cleanup'].includes(orchestratorState.phase)) {
      setView("processing");
      lastActivity.current = Date.now();
    }
  }, [orchestratorState.phase, orchestratorState.error]);

  // Rotate jokes when processing takes too long
  useEffect(() => {
    if (view !== "processing") return;

    const interval = setInterval(() => {
      if (Date.now() - lastActivity.current > 9000) {
        setJokeIndex((prev) => (prev + 1) % JOKES.length);
      }
    }, 5500);

    return () => clearInterval(interval);
  }, [view]);

  const onFileSelect = async (file: File) => {
    setView("uploading");

    const newParseId = await handleFile(file);
    if (!newParseId) {
      setView("idle");
      return;
    }

    console.log("[upload-zone] Upload complete, starting pipeline:", newParseId);

    // Run pipeline (render → classify → extract)
    const result = await runPipeline(newParseId);

    if (result.success) {
      await loadExtractionResults(newParseId);
      setView("done");
    } else {
      toast.error("Processing failed", { description: result.error });
      setView("idle");
      resetUpload();
    }
  };

  const loadExtractionResults = async (parseId: string) => {
    try {
      console.log("[upload-zone] Pipeline complete, fetching final results");
      
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
        });

        console.log("[upload-zone] ✓ Preview images are available for debugging");
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
    console.log('[upload-zone] 🧹 User clicked Complete - triggering cleanup...');

    try {
      await triggerCleanup(parseId);
      console.log('[upload-zone] ✓ Cleanup complete, navigating to transactions');
      router.push("/transactions");
    } catch (error) {
      console.warn('[upload-zone] Cleanup failed but continuing:', error);
      router.push("/transactions");
    }
  };

  const handleCancel = () => {
    resetUpload();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Upload screen */}
      {view === "idle" && (
        <>
          <Dropzone
            isUploading={false}
            currentFile={currentFile}
            onFileSelect={onFileSelect}
            onCancel={handleCancel}
          />
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

      {/* Processing screen */}
      {view === "processing" && (
        <ProcessingView 
          state={orchestratorState} 
          currentJoke={JOKES[jokeIndex]} 
        />
      )}

      {/* Results screen */}
      {view === "done" && (
        <ResultsView
          parseId={parseId}
          needsReview={orchestratorState.needsReview}
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