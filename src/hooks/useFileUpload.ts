// src/hooks/useFileUpload.ts
// Version: 2.0.0 - 2026-01-30
// BREAKING: Moved to direct Blob upload to bypass Vercel serverless body size limits
// - All PDF validation now happens client-side
// - Uses @vercel/blob client upload (no serverless function)
// - Page counting moved to separate API route after upload

import { useState } from "react";
import { toast } from "sonner";
import { upload } from "@vercel/blob/client";

export function useFileUpload() {
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [parseId, setParseId] = useState<string>("");

  const validatePdf = async (file: File): Promise<boolean> => {
    // Check file header for PDF magic bytes
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

  const uploadFile = async (file: File): Promise<string | null> => {
    try {
      console.log(`[useFileUpload] Starting direct Blob upload for ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

      // Step 1: Upload directly to Vercel Blob (bypasses serverless function)
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/parse/upload-url", // Route that generates signed URL
      });

      console.log(`[useFileUpload] Blob upload complete: ${blob.url}`);

      // Step 2: Create parse record with blob URL
      const createRes = await fetch("/api/parse/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          pdfUrl: blob.url,
          fileSize: file.size,
        }),
      });

      if (!createRes.ok) {
        const error = await createRes.json();
        throw new Error(error.error || "Failed to create parse record");
      }

      const { parseId: newParseId } = await createRes.json();
      console.log(`[useFileUpload] Parse record created: ${newParseId}`);

      return newParseId;
    } catch (error: any) {
      console.error("[useFileUpload] Upload failed:", error);
      toast.error("Upload failed", { description: error.message });
      return null;
    }
  };

  const handleFile = async (file: File): Promise<string | null> => {
    const valid = await validatePdf(file);
    if (!valid) return null;

    setCurrentFile(file);
    const newParseId = await uploadFile(file);
    
    if (newParseId) {
      setParseId(newParseId);
      console.log("[useFileUpload] Upload complete:", newParseId);
    }

    return newParseId;
  };

  const resetUpload = () => {
    setCurrentFile(null);
    setParseId("");
  };

  return {
    currentFile,
    parseId,
    handleFile,
    resetUpload,
  };
}