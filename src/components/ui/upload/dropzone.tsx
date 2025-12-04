// src/components/upload/dropzone.tsx
"use client";

import { Upload, FileText, X, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type DropzoneProps = {
  isUploading: boolean;
  currentFile: File | null;
  onFileSelect: (file: File) => void;
  onCancel: () => void;
  statusMessage?: string;        // ← NEW
  isWaitingForJoke?: boolean;    // ← NEW
};

const jokes = [
  "Don't trust AI to identify mushrooms...",
  "This is why we don't let Grok drive...",
  "Parsing legalese — the leading cause of AI therapy bills",
  "Fun fact: This PDF has more pages than my attention span",
  "Still faster than a human reading this packet",
  "Beep boop... processing California bureaucracy...",
  "Grok is now judging your buyer's handwriting",
  "Hold tight — we're teaching the AI to read realtor scribbles",
];

export function Dropzone({
  isUploading,
  currentFile,
  onFileSelect,
  onCancel,
  statusMessage = "Hold tight — analyzing your packet...",
  isWaitingForJoke = false,
}: DropzoneProps) {
  const handleDrop = (e: React.DragEvent) => {
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
          className="relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-16 text-center cursor-pointer transition-all hover:border-primary hover:bg-primary/5"
        >
          <input
            type="file"
            accept=".pdf"
            onChange={handleChange}
            disabled={isUploading}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />

          {isUploading ? (
            <div className="flex flex-col items-center gap-8">
              <Loader2 className="h-16 w-16 animate-spin text-primary" />
              <div className="space-y-3 text-center">
                <p className="text-xl font-medium text-foreground">
                  {statusMessage}
                </p>
                {isWaitingForJoke && (
                  <p className="text-lg italic text-muted-foreground animate-pulse">
                    {jokes[Math.floor(Math.random() * jokes.length)]}
                  </p>
                )}
              </div>
            </div>
          ) : currentFile ? (
            <div className="flex items-center gap-4 text-lg">
              <FileText className="h-10 w-10 text-primary" />
              <span className="font-medium truncate max-w-sm">{currentFile.name}</span>
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
              <Upload className="h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-2xl font-semibold">Drop your PDF here</p>
              <p className="text-sm text-muted-foreground mt-2">
                California RPA only • Max 25 MB
              </p>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}