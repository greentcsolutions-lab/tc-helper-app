// src/components/upload/dropzone.tsx
"use client";

import { Upload, FileText, X, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import toast from "react-hot-toast";

const MAX_FILE_SIZE_MB = 25;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

type DropzoneProps = {
  isUploading: boolean;
  currentFile: File | null;
  onFileSelect: (file: File) => void;
  onCancel: () => void;
};

export function Dropzone({ isUploading, currentFile, onFileSelect, onCancel }: DropzoneProps) {
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type === "application/pdf") {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast.error(`File too large! Max ${MAX_FILE_SIZE_MB} MB`);
        return;
      }
      onFileSelect(file);
    } else {
      toast.error("Please upload a PDF");
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast.error(`File too large! Max ${MAX_FILE_SIZE_MB} MB`);
        return;
      }
      onFileSelect(file);
    }
  };

  return (
    <Card className={`transition-all duration-300 ${isUploading || currentFile ? "ring-2 ring-primary" : ""}`}>
    <CardContent className="p-12">
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center cursor-pointer hover:border-primary transition-colors"
      >
        <input
          type="file"
          accept=".pdf"
          onChange={handleChange}
          disabled={isUploading}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />

        {isUploading ? (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-lg">Analyzing your packet...</p>
          </div>
        ) : currentFile ? (
          <div className="flex items-center gap-4 text-lg">
            <FileText className="h-10 w-10 text-primary" />
            <span className="font-medium truncate max-w-xs">{currentFile.name}</span>
            <button
              onClick={(e) => { e.stopPropagation(); onCancel(); }}
              className="rounded-full p-2 hover:bg-muted"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <>
            <Upload className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-xl font-semibold">Drop your PDF here or click to upload</p>
            <p className="mt-2 text-sm text-muted-foreground">
              California RPA packets only • Max {MAX_FILE_SIZE_MB} MB
            </p>
          </>
        )}
      </div>
    </CardContent>
  </Card>);
}