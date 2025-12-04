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
  isUploading?: boolean;
  currentFile: File | null;
  onFileSelect: (file: File) => void;
  onCancel: () => void;
};

export function Dropzone({ currentFile, onFileSelect, onCancel }: DropzoneProps) {
  const [parseId, setParseId] = useState<string | null>(null);
  const [displayedMessages, setDisplayedMessages] = useState<string[]>([]);
  const lastUpdate = useRef(Date.now());
  const toastId = useRef<string | null>(null);

  // Funny keep-alive jokes every ~3.3s
  useEffect(() => {
    if (!parseId) return;

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
  }, [parseId]);

  // Poll progress
  useEffect(() => {
    if (!parseId) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/parse/status/${parseId}`);
        if (!res.ok) return;
        const { messages, done } = await res.json();

        const newMsg = messages[messages.length - 1];
        if (newMsg && !displayedMessages.includes(newMsg)) {
          lastUpdate.current = Date.now();
          setDisplayedMessages(messages);

          if (toastId.current) toast.dismiss(toastId.current);

          if (done) {
            toastId.current = toast.success("Ready! Extracting final data...", { duration: 8000 });
          } else {
            toastId.current = toast.loading(newMsg, { duration: Infinity });
          }
        }
      } catch (e) {
        // Silent fail — network hiccup
      }
    };

    poll();
    const id = setInterval(poll, 1200);
    return () => clearInterval(id);
  }, [parseId, displayedMessages]);

  const handleUpload = async (file: File) => {
    onFileSelect(file);

    const formData = new FormData();
    formData.append("file", file);

    toast.loading("Uploading your PDF...", { duration: Infinity });
    toastId.current = null;

    try {
      const res = await fetch("/api/parse/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.success && data.parseId) {
        setParseId(data.parseId);
        setDisplayedMessages([]);
        lastUpdate.current = Date.now();
        toast.loading("Flattening PDF — removing form fields...", { duration: Infinity });
      } else {
        toast.error("Upload failed — please try again");
        onCancel();
      }
    } catch (err) {
      toast.error("Connection failed");
      onCancel();
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type === "application/pdf" && file.size <= MAX_FILE_SIZE_BYTES) {
      handleUpload(file);
    } else {
      toast.error("Please upload a valid PDF under 25 MB");
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf" && file.size <= MAX_FILE_SIZE_BYTES) {
      handleUpload(file);
    } else if (file) {
      toast.error(`File too large! Max ${MAX_FILE_SIZE_MB} MB`);
    }
  };

  return (
    <Card className={`transition-all duration-300 ${parseId || currentFile ? "ring-primary" : ""}`}>
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
            disabled={!!parseId}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />

          {parseId ? (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-lg">Hold tight — Grok is reading your packet...</p>
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
    </Card>
  );
}