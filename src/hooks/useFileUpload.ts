// src/hooks/useFileUpload.ts
// Version: 1.0.0 - 2025-12-30
// Handles file validation and upload logic

import { useState } from "react";
import { toast } from "sonner";

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
      return newParseId;
    } catch (error: any) {
      console.error("[upload] Error:", error);
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