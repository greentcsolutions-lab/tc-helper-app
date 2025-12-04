// src/components/upload/upload-zone.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { UploadView } from "./types";
import { Dropzone } from "./dropzone";
import { PreviewGallery } from "./preview-gallery";
import { ActionsBar } from "./actions-bar";
import { useRouter } from "next/navigation";

const funnyKeepAlives = [
  "Don't trust AI to identify mushrooms...",
  "This is why we don't let Grok drive...",
  "Parsing legalese — the leading cause of AI therapy bills",
  "Fun fact: This PDF has more pages than my attention span",
  "Still faster than a human reading this packet",
  "Beep boop... processing bureaucracy...",
  "Grok is now judging your buyer's handwriting",
  "Hang tight — we're teaching the AI to read REALTOR scribble",
];

export default function UploadZone({ onComplete }: { onComplete?: (data: Record<string, any>) => void }) {
  const [view, setView] = useState<UploadView>("idle");
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [parseId, setParseId] = useState<string>("");
  const [pageCount, setPageCount] = useState(0);
  const [previewPages, setPreviewPages] = useState<{ pageNumber: number; base64: string }[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const lastUpdate = useRef(Date.now());
  const router = useRouter();

  // Funny keep-alive toasts every ~3.3s while uploading
  useEffect(() => {
    if (!isUploading) return;

    const interval = setInterval(() => {
      if (Date.now() - lastUpdate.current > 3300) {
        const joke = funnyKeepAlives[Math.floor(Math.random() * funnyKeepAlives.length)];
        toast(joke, {
          duration: 4500,
          style: { background: "#1a1a1a", color: "#fff", border: "1px solid #333" },
        });
      }
    }, 3300);

    return () => clearInterval(interval);
  }, [isUploading]);

  const validatePdf = async (file: File): Promise<boolean> => {
    const header = await file.slice(0, 8).arrayBuffer();
    const view = new Uint8Array(header);
    const isPdf = view[0] === 0x25 && view[1] === 0x50 && view[2] === 0x44 && view[3] === 0x46; // %PDF

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
    setIsUploading(true);
    lastUpdate.current = Date.now();

    toast.loading("Analyzing your packet...", { duration: Infinity });

    const formData = new FormData();
    formData.append("file", file); // ← FIXED: was "form"

    try {
      const res = await fetch("/api/parse/upload", { method: "POST", body: formData }); // ← FIXED: was "form"
      const data = await res.json();

      lastUpdate.current = Date.now();

      if (!res.ok) {
        if (data.error === "invalid_pdf" || data.error === "file_too_small") {
          toast.error("Invalid or corrupted PDF", {
            description: data.message || "Please check the file and try again.",
          });
        } else {
          toast.error(data.message || "Upload failed");
        }
        setView("idle");
        setCurrentFile(null);
        setIsUploading(false);
        return;
      }

      toast.dismiss();
      toast.success("Critical pages identified");

      setParseId(data.parseId);
      setPreviewPages(data.previewPages);
      setPageCount(data.pageCount);
      setView("preview");
      setIsUploading(false);
    } catch (err) {
      toast.error("Network error – please try again");
      setView("idle");
      setCurrentFile(null);
      setIsUploading(false);
    }
  };

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
    } catch (err) {
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
    setIsUploading(false);
  };

  return (
    <div className="relative">
      {view === "idle" && <Dropzone isUploading={false} currentFile={null} onFileSelect={handleFile} onCancel={reset} />}
      {view === "uploading" && <Dropzone isUploading={true} currentFile={currentFile} onFileSelect={() => {}} onCancel={reset} />}
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