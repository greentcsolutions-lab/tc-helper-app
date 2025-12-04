// src/components/upload/dropzone.tsx
"use client";

import { Upload, FileText, X, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import toast from "react-hot-toast";
import { useState, useEffect, useRef } from "react";

const MAX_FILE_SIZE_MB = 25;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const funnyKeepAlives = [
  "Don't trust AI to identify mushrooms...",
  "This is why we don't let Grok drive...",
  "Parsing legalese — the leading cause of AI therapy bills",
  "Still faster than a human reading this packet",
  "Grok is now judging your buyer's handwriting",
  "Hold tight — we're teaching the AI to read REALTOR scribbles",
  "If this takes longer than your last situationship...",
  "Beep boop... translating bureaucracy",
];

type DropzoneProps = {
  currentFile: File | null;
  onFileSelect: (file: File) => void;
  onCancel: () => void;
};

export function Dropzone({ currentFile, onFileSelect, onCancel }: DropzoneProps) {
  const [parseId, setParseId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const lastUpdate = useRef(Date.now());
  const activeToastId = useRef<string | null>(null);

  // Funny keep-alive every 3.3s during long silence
  useEffect(() => {
    if (!isUploading || parseId === null) return;

    const interval = setInterval(() => {
      if (Date.now() - lastUpdate.current > 3300) {
        const joke = funnyKeepAlives[Math.floor(Math.random() * funnyKeepAlives.length)];
        toast(joke, {
          duration: 4500,
          style: { background: "#0f0f0f", color: "#fff", border: "1px solid #333" },
        });
      }
    }, 3300);

    return () => clearInterval(interval);
  }, [isUploading, parseId]);

  // Poll progress when we have a parseId
  useEffect(() => {
    if (!parseId) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/parse/status/${parseId}`);
        if (!res.ok) return;
        const { messages, done } = await res.json();

        const latest = messages[messages.length - 1];
        if (latest && activeToastId.current) {
          lastUpdate.current = Date.now();

          if (done) {
            toast.dismiss(activeToastId.current);
            toast.success("Ready! Extracting final data...", { duration: 8000 });
            setIsUploading(false);
          } else {
            toast.loading(latest, { id: activeToastId.current });
          }
        }
      } catch (e) {
        // silent
      }
    };

    poll();
    const id = setInterval(poll, 1200);
    return () => clearInterval(id);
  }, [parseId]);

  const startUpload = async (file: File) => {
    // Immediate feedback — this was missing before!
    onFileSelect(file);
    setIsUploading(true);
    setParseId(null);

    if (activeToastId.current) toast.dismiss(activeToastId.current);
    activeToastId.current = toast.loading("Uploading PDF...", { duration: Infinity });

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/parse/upload", { method: "POST", body: formData });
      const data = await res.json();

      if (data.success && data.parseId) {
        setParseId(data.parseId);
        lastUpdate.current = Date.now();
        toast.loading("Flattening PDF — removing form fields...", { id: activeToastId.current });
      } else {
        throw new Error(data.error || "Upload failed");
      }
    } catch (err: any) {
      toast.error("Upload failed — please try again");
      setIsUploading(false);
      onCancel();
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type === "application/pdf" && file.size <= MAX_FILE_SIZE_BYTES) {
      startUpload(file);
    } else {
      toast.error(file ? `File too large! Max ${MAX_FILE_SIZE_MB} MB` : "Please upload a PDF");
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Please upload a PDF");
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error(`File too large! Max ${MAX_FILE_SIZE_MB} MB`);
      return;
    }
    startUpload(file);
  };

  return (
    <Card className={`transition-all duration-300 ${isUploading ? "ring-2 ring-primary" : ""}`}>
      <CardContent className="p-12">
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={(e) => e.preventDefault()}
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
              <p className="text-lg font-medium">Hold tight — Grok is reading your packet...</p>
            </div>
          ) : currentFile ? (
            <div className="flex items-center gap-4 text-lg">
              <FileText className="h-10 w-10 text-primary" />
              <span className="font-medium truncate max-w-xs">{currentFile.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCancel();
                  setIsUploading(false);
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
                California RPA packets only • Max {MAX_FILE_SIZE_MB} MB
              </p>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}