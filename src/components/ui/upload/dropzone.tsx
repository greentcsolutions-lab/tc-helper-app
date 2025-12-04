// src/components/upload/dropzone.tsx
"use client";

import { Upload, FileText, X, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type DropzoneProps = {
  isUploading: boolean;
  currentFile: File | null;
  onFileSelect: (file: File) => void;
  onCancel: () => void;
  statusMessage?: string;
  currentJoke?: string; // ← the rotating joke from upload-zone
};

export function Dropzone({
  isUploading,
  currentFile,
  onFileSelect,
  onCancel,
  statusMessage = "Analyzing your packet...",
  currentJoke,
}: DropzoneProps) {
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file) onFileSelect(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
  };

  return (
    <Card className={`transition-all duration-300 ${isUploading ? "ring-2 ring-primary" : ""}`}>
      <CardContent className="p-12">
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onDragEnter={(e) => e.preventDefault()}
          className="relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-16 text-center cursor-pointer transition-all hover:border-primary hover:bg-primary/5"
        >
          <input
            type="file"
            accept=".pdf"
            onChange={handleChange}
            disabled={isUploading}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />

          {/* UPLOADING STATE — BIG, CENTERED, WITH ROTATING JOKES */}
          {isUploading ? (
            <div className="flex flex-col items-center gap-8">
              <Loader2 className="h-16 w-16 animate-spin text-primary" />

              <div className="max-w-lg space-y-4 text-center">
                <p className="text-xl font-medium text-foreground">
                  {statusMessage}
                </p>

               

                {currentJoke && (
                  <p className="text-lg italic text-muted-foreground animate-pulse leading-relaxed">
                    {currentJoke}
                  </p>
                )}
              </div>
            </div>
          ) : currentFile ? (
            /* FILE SELECTED STATE */
            <div className="flex items-center gap-4 text-lg">
              <FileText className="h-10 w-10 text-primary" />
              <span className="font-medium truncate max-w-md">{currentFile.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCancel();
                }}
                className="rounded-full p-2 hover:bg-muted transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          ) : (
            /* IDLE STATE */
            <>
              <Upload className="h-16 w-16 text-muted-foreground mb-6" />
              <p className="text-2xl font-semibold text-foreground">
                Drop your PDF here
              </p>
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