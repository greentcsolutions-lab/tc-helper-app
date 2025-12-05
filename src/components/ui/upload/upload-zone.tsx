// src/components/upload/upload-zone.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { UploadView } from "./types";
import { Dropzone } from "./dropzone";
import { PreviewGallery } from "./preview-gallery";
import { ActionsBar } from "./actions-bar";
import { useRouter } from "next/navigation";

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

export default function UploadZone({ onComplete }: { onComplete?: (data: any) => void }) {
  const [view, setView] = useState<UploadView>("idle");
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [parseId, setParseId] = useState<string>("");
  const [pageCount, setPageCount] = useState(0);
  const [previewPages, setPreviewPages] = useState<{ pageNumber: number; base64: string }[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [liveMessage, setLiveMessage] = useState("Hang tight — analyzing your packet...");
  const lastActivity = useRef(Date.now());
  const [jokeIndex, setJokeIndex] = useState(0);

  const router = useRouter();

  // Joke rotation when silent
  useEffect(() => {
    if (!isAnalyzing) return;

    const interval = setInterval(() => {
      if (Date.now() - lastActivity.current > 3500) {
        setJokeIndex(prev => (prev + 1) % JOKES.length);
        setLiveMessage(JOKES[jokeIndex]);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [isAnalyzing, jokeIndex]);

  // Poll real server messages
  useEffect(() => {
    if (!isAnalyzing || !parseId) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/parse/status/${parseId}`);
        if (!res.ok) return;
        const { messages } = await res.json();

        if (messages.length > 0) {
          const latest = messages[messages.length - 1];
          setLiveMessage(latest);
          lastActivity.current = Date.now();
        }
      } catch {}
    };

    poll();
    const id = setInterval(poll, 1200);
    return () => clearInterval(id);
  }, [isAnalyzing, parseId]);

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
    setIsAnalyzing(true);
    setLiveMessage("Hold tight — analyzing your packet...");
    lastActivity.current = Date.now();
    setJokeIndex(0);
  };

  useEffect(() => {
    if (!isAnalyzing || !currentFile) return;

    const upload = async () => {
      const formData = new FormData();
      formData.append("file", currentFile);

      try {
        const res = await fetch("/api/parse/upload", { method: "POST", body: formData });
        const data = await res.json();

        if (!res.ok) throw new Error(data.message || "Failed");

        setParseId(data.parseId);
        setLiveMessage("Critical pages identified — loading preview...");
        lastActivity.current = Date.now();

        setTimeout(() => {
          setPreviewPages(data.previewPages);
          setPageCount(data.pageCount);
          setView("preview");
          setIsAnalyzing(false);
        }, 800);
      } catch {
        toast.error("Upload failed — try again");
        setView("idle");
        setCurrentFile(null);
        setIsAnalyzing(false);
      }
    };

    upload();
  }, [isAnalyzing, currentFile]);

  const handleConfirm = async () => {
    setIsExtracting(true);
    try {
      const res = await fetch(`/api/parse/extract/${parseId}`, { method: "POST" });
      const data = await res.json();
      if (!data.success) throw new Error();

      if (data.needsReview) {
        router.push(`/review/${parseId}`);
      } else {
        onComplete?.(data.extracted);
        setView("done");
      }
    } catch {
      toast.error("Extraction failed");
    } finally {
      setIsExtracting(false);
    }
  };

    return (
    <div className="relative">
      {view === "idle" && (
        <Dropzone
          isUploading={false}
          currentFile={null}
          onFileSelect={handleFile}
          onCancel={() => setView("idle")}
        />
      )}

      {view === "uploading" && (
        <Dropzone
          isUploading={true}
          currentFile={currentFile}
          onFileSelect={() => {}}
          onCancel={() => setView("idle")}
          liveText={liveMessage}
        />
      )}

      {view === "preview" && (
        <>
          <PreviewGallery pages={previewPages} onLoaded={() => {}} />
          <ActionsBar
            onConfirm={handleConfirm}
            onCancel={() => setView("idle")}
            pageCount={pageCount}
            isExtracting={isExtracting}
          />
        </>
      )}

      {/* ← NEW PRIVACY NOTICE (appears on all three views) */}
      {(view === "idle" || view === "uploading") && (
        <div className="mt-8 text-center px-4">
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            By uploading, you agree to secure processing of your document via trusted U.S. and EU providers
            (PDFRest & xAI Grok). Your PDF and all images are{" "}
            <span className="font-medium text-foreground">automatically deleted within minutes</span> after extraction.
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