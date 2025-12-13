// src/components/ui/upload/upload-zone.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { UploadView } from "./types";
import { Dropzone } from "./dropzone";
import { PreviewGallery } from "./preview-gallery";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import CategoryPurchaseTerms from "@/components/CategoryPurchaseTerms";
import CategoryTimelineContingencies from "@/components/CategoryTimelineContingencies";
import CategoryRepresentingParties from "@/components/CategoryRepresentingParties";

const JOKES = [
  "Don't trust AI to identify mushrooms...",
  "This is why we don't let Grok drive...",
  "Parsing legalese — the leading cause of AI therapy bills",
  "Fun fact: This PDF has more pages than my attention span",
  "Still faster than a human reading this packet",
  "Beep boop... processing California bureaucracy...",
  "Grok is now judging your buyer's handwriting",
  "Hang tight — we're teaching the AI to read realtor scribbles",
];

export default function UploadZone() {
  const [view, setView] = useState<UploadView>("idle");
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [parseId, setParseId] = useState<string>("");
  const [zipUrl, setZipUrl] = useState<string>("");
  const [extractedData, setExtractedData] = useState<any>(null);
  const [criticalPageNumbers, setCriticalPageNumbers] = useState<number[]>([]);

  const [liveMessage, setLiveMessage] = useState("Starting AI analysis...");
  const [jokeIndex, setJokeIndex] = useState(0);
  const lastActivity = useRef(Date.now());

  const router = useRouter();

  // Joke rotation when no updates for 5+ seconds
  useEffect(() => {
    if (view !== "processing") return;

    const interval = setInterval(() => {
      if (Date.now() - lastActivity.current > 5000) {
        setJokeIndex((prev) => (prev + 1) % JOKES.length);
        setLiveMessage(JOKES[jokeIndex]);
      }
    }, 5500);

    return () => clearInterval(interval);
  }, [view, jokeIndex]);

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
    setLiveMessage("Uploading your document...");
    lastActivity.current = Date.now();

    // Upload file
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/parse/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Upload failed: ${res.status}`);
      }

      const data = await res.json();
      console.log("[Upload] Success:", data);

      if (!data.parseId) {
        throw new Error("No parseId returned from upload");
      }

      setParseId(data.parseId);
      setView("processing");
      setLiveMessage("Starting AI analysis...");
      lastActivity.current = Date.now();

      // Connect to SSE processing endpoint
      console.log("[SSE] Connecting to:", `/api/parse/process/${data.parseId}`);
      const eventSource = new EventSource(`/api/parse/process/${data.parseId}`);

      eventSource.onmessage = (event) => {
        console.log("[SSE] Message received:", event.data);
        const data = JSON.parse(event.data);
        lastActivity.current = Date.now();

        if (data.type === "progress") {
          setLiveMessage(data.message);
          console.log(`[SSE] ${data.stage}: ${data.message}`);

          if (data.criticalPageNumbers) {
            setCriticalPageNumbers(data.criticalPageNumbers);
          }
        } else if (data.type === "complete") {
          console.log("[SSE] Extraction complete!", data);
          setExtractedData(data.extracted);
          setZipUrl(data.zipUrl);
          setCriticalPageNumbers(data.criticalPageNumbers);
          setView("done");
          eventSource.close();
        } else if (data.type === "error") {
          console.error("[SSE] Error received:", data);
          toast.error("Extraction failed", { description: data.message });
          setView("idle");
          setCurrentFile(null);
          eventSource.close();
        }
      };

      eventSource.onerror = (err) => {
        console.error("[SSE] Connection error:", err);
        console.error("[SSE] ReadyState:", eventSource.readyState);
        toast.error("Connection lost", { description: "Please try again" });
        setView("idle");
        setCurrentFile(null);
        eventSource.close();
      };
    } catch (err: any) {
      console.error("[Upload] Failed:", err);
      toast.error("Upload failed", { description: err.message });
      setView("idle");
      setCurrentFile(null);
    }
  };

  const handleConfirmAndContinue = async () => {
    // Delete critical page images
    if (zipUrl) {
      try {
        await fetch(`/api/parse/cleanup/${parseId}`, { method: "POST" });
      } catch (err) {
        console.warn("Cleanup failed:", err);
      }
    }

    // Redirect to dashboard
    router.push("/dashboard");
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
        <Dropzone
          isUploading={true}
          currentFile={currentFile}
          onFileSelect={() => {}}
          onCancel={() => setView("idle")}
          liveText={liveMessage}
        />
      )}

      {view === "done" && extractedData && (
        <>
          <Card className="border-2 border-green-500/30 bg-green-50/50 dark:bg-green-950/20">
            <CardContent className="p-8 text-center">
              <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
              <h2 className="text-3xl font-bold mb-2">Extraction Complete!</h2>
              <p className="text-muted-foreground mb-6">
                Found {criticalPageNumbers.length} critical pages • Extracted {Object.keys(extractedData).length} fields
              </p>
            </CardContent>
          </Card>

          {/* Display extracted data */}
          <div className="space-y-6">
            <CategoryPurchaseTerms data={extractedData} />
            <CategoryTimelineContingencies data={extractedData} />
            <CategoryRepresentingParties data={extractedData} />
          </div>

          {/* Show critical page thumbnails */}
          {zipUrl && (
            <div>
              <h3 className="text-xl font-bold mb-4">Critical Pages Used for Extraction</h3>
              <PreviewGallery zipUrl={zipUrl} maxPages={criticalPageNumbers.length} />
            </div>
          )}

          {/* Confirm button */}
          <div className="flex justify-center pt-8">
            <Button
              size="lg"
              onClick={handleConfirmAndContinue}
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
            >
              Looks Good — Continue to Dashboard
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
