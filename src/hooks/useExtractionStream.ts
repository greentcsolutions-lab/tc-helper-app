// src/hooks/useExtractionStream.ts
// Custom hook for Server-Sent Events extraction progress using fetch + ReadableStream
"use client";

import { useEffect, useRef, useState } from "react";

export type ExtractionPhase = "loading" | "extract" | "processing" | "saving" | "complete" | "error";

export type ExtractionProgress = {
  phase: ExtractionPhase;
  message: string;
  needsReview?: boolean;
  confidence?: number;
  totalPages?: number;
  modelUsed?: string;
};

export function useExtractionStream(parseId: string | null, enabled: boolean) {
  const [progress, setProgress] = useState<ExtractionProgress>({
    phase: "loading",
    message: "Got your document",
  });
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!enabled || !parseId) return;

    console.log("[useExtractionStream] Starting SSE stream for parseId:", parseId);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const startStream = async () => {
      try {
        const response = await fetch(`/api/parse/extract/${parseId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        if (!response.body) {
          throw new Error("Response body is null");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            console.log("[useExtractionStream] Stream complete");
            break;
          }

          // Decode the chunk and add to buffer
          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE messages (split by double newline)
          const messages = buffer.split("\n\n");
          buffer = messages.pop() || ""; // Keep incomplete message in buffer

          for (const message of messages) {
            if (!message.trim()) continue;

            // Parse SSE format: "data: {json}"
            const dataMatch = message.match(/^data: (.+)$/m);
            if (!dataMatch) continue;

            try {
              const data = JSON.parse(dataMatch[1]);
              console.log("[useExtractionStream] Received:", data);

              if (data.type === "progress") {
                setProgress({
                  phase: data.phase,
                  message: data.message,
                });
              } else if (data.type === "complete") {
                setProgress({
                  phase: "complete",
                  message: data.message,
                  needsReview: data.needsReview,
                  confidence: data.confidence,
                  totalPages: data.totalPages,
                  modelUsed: data.modelUsed,
                });
                setIsComplete(true);
              } else if (data.type === "error") {
                setError(data.message);
                setProgress({
                  phase: "error",
                  message: data.message,
                });
              }
            } catch (err) {
              console.error("[useExtractionStream] Failed to parse message:", err);
            }
          }
        }
      } catch (err: any) {
        if (err.name === "AbortError") {
          console.log("[useExtractionStream] Stream aborted");
          return;
        }

        console.error("[useExtractionStream] Stream error:", err);
        setError(err.message);
        setProgress({
          phase: "error",
          message: err.message || "Connection error",
        });
      }
    };

    startStream();

    // Cleanup on unmount
    return () => {
      console.log("[useExtractionStream] Cleaning up stream");
      abortController.abort();
    };
  }, [parseId, enabled]);

  return { progress, isComplete, error };
}
