// src/components/ui/upload/upload-zone.tsx
// Version: 2.0.0 - 2025-12-27
// Updated to use useParseOrchestrator hook for new pipeline architecture

"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { UploadView } from "./types";
import { Dropzone } from "./dropzone";
import { PreviewGallery } from "./preview-gallery";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, ArrowRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useParseOrchestrator } from "@/hooks/useParseOrchestrator";

import ExtractionCategories from "@/components/ExtractionCategories";

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

// Phase-specific messages
const PHASE_MESSAGES: Record<string, string> = {
  render: "Converting PDF to high-quality images...",
  classify: "AI is reading the document structure...",
  extract: "Extracting transaction data from critical pages...",
  cleanup: "Cleaning up temporary files...",
  complete: "Extraction complete!",
};

export default function UploadZone() {
  const [view, setView] = useState<UploadView>("idle");
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [parseId, setParseId] = useState<string>("");
  const [extractedData, setExtractedData] = useState<any>(null);

  const [jokeIndex, setJokeIndex] = useState(0);
  const lastActivity = useRef(Date.now());

  const router = useRouter();
  const { state: orchestratorState, runPipeline } = useParseOrchestrator();

  // Update view based on orchestrator state
  useEffect(() => {
    if (orchestratorState.phase === 'idle') {
      return;
    }

    if (orchestratorState.phase === 'error') {
      setView("idle");
      toast.error("Processing failed", { 
        description: orchestratorState.error || "An error occurred" 
      });
      return;
    }

    if (orchestratorState.phase === 'complete') {
      setView("done");
      // The extracted data will be fetched from DB
      return;
    }

    // Any processing phase
    if (['render', 'classify', 'extract', 'cleanup'].includes(orchestratorState.phase)) {
      setView("processing");
      lastActivity.current = Date.now();
    }
  }, [orchestratorState.phase, orchestratorState.error]);

  // Joke rotation when no updates for 5+ seconds
  useEffect(() => {
    if (view !== "processing") return;

    const interval = setInterval(() => {
      if (Date.now() - lastActivity.current > 9000) {
        setJokeIndex((prev) => (prev + 1) % JOKES.length);
      }
    }, 5500);

    return () => clearInterval(interval);
  }, [view]);

  const validatePdf = async (file: File): Promise<boolean> => {
    const header = await file.slice(0, 8).arrayBuffer();
    const view = new Uint8Array(header);
    const isPdf = view[0] === 0x25 && view[1] === 0x50 && view[2] === 0x44 && view[3] === 0x46;

    if (!isPdf) {
      toast.error("Not a valid PDF", { description: "Please upload a proper PDF file." });
      return false;
    }
    if (file.size < 10_000) {
      toast.error("File too small", { description: "This PDF might be corrupted." });
      return false;
    }
    if (file.size > 25_000_000) {
      toast.error("File too large", { description: "Max 25 MB" });
      return false;
    }
    return true;
  };

  const handleFile = async (file: File) => {
    const valid = await validatePdf(file);
    if (!valid) return;

    setCurrentFile(file);
    setView("uploading");

    // STEP 1: Upload file
    const formData = new FormData();
    formData.append("file", file);

    try {
      const uploadRes = await fetch("/api/parse/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const error = await uploadRes.json();
        throw new Error(error.error || "Upload failed");
      }

      const { parseId: newParseId } = await uploadRes.json();
      setParseId(newParseId);

      console.log("[upload-zone] Upload complete, starting pipeline:", newParseId);

      // STEP 2: Run pipeline (render → classify → extract → cleanup)
      const result = await runPipeline(newParseId);

      if (result.success) {
        console.log("[upload-zone] Pipeline complete, fetching final results");
        
        // Fetch the final extraction results from DB
        const finalizeRes = await fetch(`/api/parse/finalize/${newParseId}`);
        
        if (finalizeRes.ok) {
          const { data } = await finalizeRes.json();
          
          // Map DB fields to UI format
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
        }

        setView("done");
      } else {
        throw new Error(result.error || "Pipeline failed");
      }
    } catch (error: any) {
      console.error("[upload-zone] Error:", error);
      toast.error("Processing failed", { description: error.message });
      setView("idle");
      setCurrentFile(null);
    }
  };

  const handleConfirmAndContinue = () => {
    router.push("/dashboard");
  };

  // Get current display message
  const getCurrentMessage = (): string => {
    if (view === "uploading") {
      return "Uploading your document...";
    }

    if (orchestratorState.phase === 'idle' || orchestratorState.phase === 'error') {
      return "";
    }

    // Use custom message from orchestrator if available
    if (orchestratorState.message) {
      return orchestratorState.message;
    }

    // Fallback to phase-specific message
    if (orchestratorState.phase in PHASE_MESSAGES) {
      return PHASE_MESSAGES[orchestratorState.phase];
    }

    // If idle for too long, show joke
    if (Date.now() - lastActivity.current > 9000) {
      return JOKES[jokeIndex];
    }

    return "Processing...";
  };

  // Get progress details for display
  const getProgressDetails = (): string => {
    const parts: string[] = [];

    if (orchestratorState.pageCount) {
      parts.push(`${orchestratorState.pageCount} pages`);
    }

    if (orchestratorState.criticalPageCount) {
      parts.push(`${orchestratorState.criticalPageCount} critical`);
    }

    if (orchestratorState.phase === 'extract') {
      parts.push('extracting data');
    }

    if (orchestratorState.phase === 'cleanup') {
      parts.push('cleaning up');
    }

    return parts.length > 0 ? `(${parts.join(' • ')})` : '';
  };

  return (
    <div className="relative space-y-8">
      {view === "idle" && (
        <Dropzone
          isUploading={false}
          currentFile={null}
          onFileSelect={handleFile}
          onCancel={() => setView("idle")}
        />
      )}

      {(view === "uploading" || view === "processing") && (
        <div className="space-y-4">
          <Dropzone
            isUploading={true}
            currentFile={currentFile}
            onFileSelect={() => {}}
            onCancel={() => {
              // Cancel not allowed during processing
            }}
            liveText={getCurrentMessage()}
          />

          {/* Progress details */}
          {view === "processing" && orchestratorState.phase !== 'idle' && (
            <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      Phase: {orchestratorState.phase.toUpperCase()}
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      {getProgressDetails()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {view === "done" && extractedData && (
        <>
          <Card className="border-2 border-green-500/30 bg-green-50/50 dark:bg-green-950/20">
            <CardContent className="p-8 text-center">
              <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
              <h2 className="text-3xl font-bold mb-2">Extraction Complete!</h2>
              <p className="text-muted-foreground mb-2">
                {orchestratorState.pageCount && `${orchestratorState.pageCount} pages analyzed`}
                {orchestratorState.criticalPageCount && ` • ${orchestratorState.criticalPageCount} critical pages used`}
              </p>
              {orchestratorState.needsReview && (
                <p className="text-sm text-orange-600 font-medium mt-2">
                  ⚠️ Review recommended — some fields had low confidence
                </p>
              )}
            </CardContent>
          </Card>

          {/* Extracted data display */}
          <ExtractionCategories data={extractedData} />

          {/* Show critical page thumbnails if we have the parseId */}
          {parseId && (
            <div>
              <h3 className="text-xl font-bold mb-4">Critical Pages Used for Extraction</h3>
              <p className="text-sm text-muted-foreground mb-4">
                These {orchestratorState.criticalPageCount || 'key'} pages contained the most important transaction information.
              </p>
              {/* Note: PreviewGallery needs to fetch from finalize endpoint or we pass lowResZipUrl */}
              <PreviewGallery 
                zipUrl={`/api/parse/preview/${parseId}`} 
                maxPages={orchestratorState.criticalPageCount || 10} 
              />
            </div>
          )}

          {/* Confirm button */}
          <div className="flex justify-center pt-8">
            <Button
              size="lg"
              onClick={handleConfirmAndContinue}
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
            >
              {orchestratorState.needsReview ? "Review in Dashboard" : "Looks Good — Continue to Dashboard"}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </>
      )}

      {/* Privacy notice */}
      {(view === "idle" || view === "uploading") && (
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
      )}
    </div>
  );
}