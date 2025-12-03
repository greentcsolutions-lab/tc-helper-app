// src/components/upload/upload-zone.tsx
"use client";

import { useState } from "react";
import { toast } from "sonner"; // ← using sonner (you already have it)
import { UploadView } from "./types";
import { Dropzone } from "./dropzone";
import { PreviewGallery } from "./preview-gallery";
import { ActionsBar } from "./actions-bar";
import { useRouter } from "next/navigation";

export default function UploadZone({ onComplete }: { onComplete?: (data: Record<string, any>) => void }) {
  const [view, setView] = useState<UploadView>("idle");
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [parseId, setParseId] = useState<string>("");
  const [pageCount, setPageCount] = useState(0);
  const [previewPages, setPreviewPages] = useState<{ pageNumber: number; base64: string }[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const router = useRouter();

  const validatePdf = async (file: File): Promise<boolean> => {
    // Client-side magic bytes check
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

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch("/api/parse/upload", { method: "POST", body: form });
      const data = await res.json();

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
        return;
      }

      setParseId(data.parseId);
      setPreviewPages(data.previewPages);
      setPageCount(data.pageCount);
      setView("preview");
      toast.success("Critical pages identified");
    } catch (err) {
      toast.error("Network error – please try again");
      setView("idle");
      setCurrentFile(null);
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