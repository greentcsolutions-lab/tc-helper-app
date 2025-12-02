// src/components/upload/upload-zone.tsx  ← Only changes: API endpoint + confirm logic
"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import { UploadView } from "./types";
import { Dropzone } from "./dropzone";
import { PreviewGallery } from "./preview-gallery";
import { ActionsBar } from "./actions-bar";
import { useRouter } from "next/navigation";  // ← Add for optional redirect

export default function UploadZone({ onComplete }: { onComplete?: (data: any) => void }) {  // ← Optional callback
  const [view, setView] = useState<UploadView>("idle");
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [parseId, setParseId] = useState<string>("");
  const [pageCount, setPageCount] = useState(0);
  const [previewPages, setPreviewPages] = useState<{ pageNumber: number; base64: string }[]>([]);  // ← New: Critical pages
  const [isExtracting, setIsExtracting] = useState(false);  // ← New: Spinner state
  const router = useRouter();

  const handleFile = async (file: File) => {
    setCurrentFile(file);
    setView("uploading");

    const form = new FormData();
    form.append("file", file);

    try {
      // ← Change: POST to /upload (classify-only)
      const res = await fetch("/api/parse/upload", { method: "POST", body: form });
      const data = await res.json();

      if (!data.success) throw new Error(data.userMessage || "Failed");

      setParseId(data.parseId);
      setPreviewPages(data.previewPages);  // ← Set critical pages
      setPageCount(data.pageCount);
      setView("preview");
      toast.success("Critical pages identified");
    } catch (err) {
      toast.error("Upload failed");
      setCurrentFile(null);
      setView("idle");
    }
  };

  const handleConfirm = async () => {
    setIsExtracting(true);
    try {
      // ← New: POST to /extract — triggers Grok
      const res = await fetch(`/api/parse/extract/${parseId}`, { method: "POST" });
      const data = await res.json();

      if (!data.success) throw new Error("Extraction failed");

      toast.success("Extraction complete");
      if (data.needsReview) {
        router.push(`/review/${parseId}`);  // ← Keep for low-confidence
      } else {
        onComplete?.(data.extracted);  // ← In-page callback for auto-good cases
        setView("done");  // ← Or add a "done" view
      }
    } catch (err) {
      toast.error("Extraction failed");
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
          <PreviewGallery pages={previewPages} onLoaded={() => {}} />  {/* ← Pass pages directly, no SSE */}
          <ActionsBar 
            onConfirm={handleConfirm} 
            onCancel={reset} 
            pageCount={pageCount}
            isExtracting={isExtracting}  // ← Pass for spinner
          />
        </>
      )}
    </div>
  );
}