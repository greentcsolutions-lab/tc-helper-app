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
  "Beep boop... processing bureaucracy...",
  "Grok is now judging your buyer's handwriting",
  "Hang tight — we're teaching the AI to read realtor scribbles",
];

export default function UploadZone({ onComplete }: { onComplete?: (data: Record<string, any>) => void }) {
  const [view, setView] = useState<UploadView>("idle");
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [parseId, setParseId] = useState<string>("");
  const [pageCount, setPageCount] = useState(0);
  const [previewPages, setPreviewPages] = useState<{ pageNumber: number; base64: string }[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const lastActivity = useRef(Date.now());
  const [jokeIndex, setJokeIndex] = useState(0);

  const router = useRouter();

  // Rotating jokes every 4 seconds while silent
  useEffect(() => {
    if (!isAnalyzing) return;

    const interval = setInterval(() => {
      if (Date.now() - lastActivity.current > 3500) {
        setJokeIndex(prev => (prev + 1) % JOKES.length);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [isAnalyzing]);

  const validatePdf = async (file: File): Promise<boolean> => {
    const header = await file.slice(0, 8).arrayBuffer();
    const view = new Uint8Array(header);
    const isPdf = view[0] === 0x25 && view[1] === 0x50 && view[2] === 0x44 && view[3] === 0x46;

    if (!isPdf) {
      toast.error("This doesn't look like a PDF file", {
        description: "Please select a valid PDF document.",
      });
      return false;
    }

    if (file.size < 10_000) {
      toast.error("This file appears corrupted", {
        description: "Please re-save or re-download the PDF and try again.",
      });
      return false;
    }

    if (file.size > 25_000_000) {
      toast.error("File too large", {
        description: "Maximum file size is 25 MB.",
      });
      return false;
    }

    return true;
  };

  const handleFile = async (file: File) => {
    const isValid = await validatePdf(file);
    if (!isValid) return;

    setCurrentFile(file);
    setView("uploading");
    setIsAnalyzing(true);
    lastActivity.current = Date.now();
    setJokeIndex(0);
  };

  // Upload logic
  useEffect(() => {
    if (!isAnalyzing || !currentFile) return;

    const upload = async () => {
      const formData = new FormData();
      formData.append("file", currentFile);

      try {
        const res = await fetch("/api/parse/upload", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();

        lastActivity.current = Date.now(); // Reset joke timer

        if (!res.ok) throw new Error(data.message || "Upload failed");

        setParseId(data.parseId);
        setPreviewPages(data.previewPages);
        setPageCount(data.pageCount);
        setView("preview");
        toast.success("Critical pages identified");
      } catch {
        toast.error("Upload failed — please try again");
        reset();
      } finally {
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

      if (!data.success) throw new Error("Extraction failed");

      toast.success("Extraction complete");
      if (data.needsReview) {
        router.push(`/review/${parseId}`);
      } else {
        onComplete?.(data.extracted);
        setView("done");
      }
    } catch {
      toast.error("Extraction failed – please try again");
    } finally {
      setIsExtracting(false);
    }
  };

  const reset = () => {
    setView("idle");
    setCurrentFile(null);
    setParseId("");
    setPageCount(0);
    setPreviewPages([]);
    setIsAnalyzing(false);
    setJokeIndex(0);
  };

  return (
    <div className="relative">
      {view === "idle" && (
        <Dropzone
          isUploading={false}
          currentFile={null}
          onFileSelect={handleFile}
          onCancel={reset}
        />
      )}

      {view === "uploading" && (
        <Dropzone
          isUploading={true}
          currentFile={currentFile}
          onFileSelect={() => {}}
          onCancel={reset}
          statusMessage="Analyzing your packet..."
          currentJoke={JOKES[jokeIndex]}
        />
      )}

      {view === "preview" && (
        <>
          <PreviewGallery pages={previewPages} onLoaded={() => {}} />
          <ActionsBar
            onConfirm={handleConfirm}
            onCancel={reset}
            pageCount={pageCount}
            isExtracting={isExtracting}
          />
        </>
      )}
    </div>
  );
}