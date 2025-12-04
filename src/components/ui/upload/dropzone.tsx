// src/components/upload/dropzone.tsx
"use client";

import { Upload, FileText, X, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useDropzone } from "react-dropzone"; // Assuming you have this; if not, add to package.json
import { useCallback } from "react";

type DropzoneProps = {
  isUploading: boolean;
  currentFile: File | null;
  onFileSelect: (file: File) => void;
  onCancel: () => void;
};

export function Dropzone({ 
  isUploading, 
  currentFile, 
  onFileSelect, 
  onCancel 
}: DropzoneProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onFileSelect(acceptedFiles[0]); // ← This triggers parent's handleFile → upload route instantly
    }
  }, [onFileSelect]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxSize: 25 * 1024 * 1024, // 25 MB
    disabled: isUploading,
    multiple: false,
  });

  return (
    <Card className={`transition-all duration-300 ${isUploading ? "ring-2 ring-primary" : ""}`}>
      <CardContent className="p-12">
        <div
          {...getRootProps()}
          className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center cursor-pointer transition-colors ${
            isDragActive ? "border-primary bg-primary/5" : "border-muted hover:border-primary"
          }`}
        >
          <input {...getInputProps()} />
          {isUploading ? (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-lg">Hold tight — analyzing your packet...</p>
            </div>
          ) : currentFile ? (
            <div className="flex items-center gap-4 text-lg">
              <FileText className="h-10 w-10 text-primary" />
              <span className="font-medium truncate max-w-xs">{currentFile.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCancel();
                }}
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
                California RPA packets only • Max 25 MB
              </p>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}