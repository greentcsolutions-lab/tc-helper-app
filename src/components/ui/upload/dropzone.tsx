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
  "Grok is now judging your buyer's handwriting",
  "Still faster than a human reading this packet",
  "Beep boop... translating Real Estate legalese",
  "Hold tight — teaching the AI to read REALTOR scribbles",
  "This is why we don't let Grok drive...",
];

type DropzoneProps = {
  onFileSelect: (file: File) => void;
  onCancel: () => void;
  currentFile: File | null;
};

export function Dropzone({ onFileSelect, onCancel, currentFile }: DropzoneProps) {
  const [parseId, setParseId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const lastUpdate = useRef(Date.now());
  const activeToast = useRef<string | null>(null);

  // Keep-alive jokes every 3.3s
  useEffect(() => {
    if (!isProcessing) return;
    const id = setInterval(() => {
      if (Date.now() - lastUpdate.current > 3300) {
        toast(funnyKeepAlives[Math.floor(Math.random() * funnyKeepAlives.length)], {
          duration: 5000,
          style: { background: "#0f0f0f", color: "#fff" },
        });
      }
    }, 3300);
    return () => clearInterval(id);
  }, [isProcessing]);

  // Poll progress
  useEffect(() => {
    if (!parseId) return;

    const poll = async () => {
      const res = await fetch(`/api/parse/status/${parseId}`);
      if (!res.ok) return;
      const { messages, done } = await res.json();
      const latest = messages[messages.length - 1];
      if (latest) {
        lastUpdate.current = Date.now();
        if (done) {
          if (activeToast.current) toast.dismiss(activeToast.current);
          toast.success("Ready! Extracting final data...", { duration: 8000 });
          setIsProcessing(false);
        } else if (activeToast.current) {
          toast.loading(latest, { id: activeToast.current });
        }
      }
    };

    poll();
    const interval = setInterval(poll, 1200);
    return () => clearInterval(interval);
  }, [parseId]);

  const uploadFile = async (file: File) => {
    // IMMEDIATE visual feedback — this was missing
    onFileSelect(file);
    setIsProcessing(true);
    setParseId(null);

    if (activeToast.current) toast.dismiss(activeToast.current);
    activeToast.current = toast.loading("Uploading your PDF...", { duration: Infinity });

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/parse/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.success && data.parseId) {
        setParseId(data.parseId);
        lastUpdate.current = Date.now();
        toast.loading("Flattening PDF — removing form fields...", { id: activeToast.current });
      } else {
        throw new Error("Upload failed");
      }
    } catch (err) {
      toast.error("Upload failed — please try again");
      setIsProcessing(false);
      onCancel();
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const file = e.dataTransfer.files[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast.error("Please upload a PDF");
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error(`File too large! Max ${MAX_FILE_SIZE_MB} MB`);
      return;
    }

    uploadFile(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    uploadFile(file);
  };

  return (
    <Card className="transition-all duration-300">
      <CardContent className="p-12">
        <div
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className="relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-12 text-center hover:border-primary hover:bg-gray-100 transition-all cursor-pointer"
        >
          <input
            type="file"
            accept=".pdf"
            onChange={handleInputChange}
            className="absolute inset-0 opacity-0 cursor-pointer"
            disabled={isProcessing}
          />

          {isProcessing ? (
            <div className="flex flex-col items-center gap-6">
              <Loader2 className="h-16 w-16 animate-spin text-primary" />
              <div className="text-lg font-medium text-gray-700">
                Hold tight — Grok is reading your packet...
              </div>
            </div>
          ) : currentFile ? (
            <div className="flex items-center gap-4 text-lg">
              <FileText className="h-10 w-10 text-primary" />
              <span className="font-medium truncate max-w-md">{currentFile.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCancel();
                  setIsProcessing(false);
                }}
                className="rounded-full p-2 hover:bg-gray-200 hover:bg-gray-300 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <>
              <Upload className="mb-4 h-16 w-16 text-gray-400" />
              <p className="text-xl font-semibold text-gray-700">
                Drop your PDF here or click to upload
              </p>
              <p className="mt-2 text-sm text-gray-500">
                California RPA packets only • Max {MAX_FILE_SIZE_MB} MB
              </p>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}