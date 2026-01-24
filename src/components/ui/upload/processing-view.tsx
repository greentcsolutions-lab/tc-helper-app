// src/components/ui/upload/processing-view.tsx
// Version: 3.0.0 - 2026-01-24
// Displays real-time extraction progress with SSE stream + flavor text

"use client";

import { useState, useEffect } from "react";
import { ExtractionProgress } from "@/hooks/useExtractionStream";

type ProcessingViewProps = {
  progress: ExtractionProgress;
};

const FLAVOR_TEXT_BY_PHASE: Record<string, string[]> = {
  loading: [
    "Got your document",
    "Checking the file...",
    "Almost ready...",
  ],
  extract: [
    "Reading through your contract",
    "PDFs can be tricky, hang tight...",
    "Scanning all those pages...",
    "The AI is working its magic...",
    "Teaching the AI to read realtor handwriting...",
    "Parsing through the legal jargon...",
  ],
  processing: [
    "Organizing the details",
    "Cleaning up the data...",
    "Double-checking everything...",
  ],
  saving: [
    "Saving your information",
    "Writing to the database...",
    "Finishing up...",
  ],
};

export function ProcessingView({ progress }: ProcessingViewProps) {
  const [displayMessage, setDisplayMessage] = useState(progress.message);
  const [flavorIndex, setFlavorIndex] = useState(0);
  const [lastPhase, setLastPhase] = useState(progress.phase);

  // Reset flavor index when phase changes
  useEffect(() => {
    if (progress.phase !== lastPhase) {
      setFlavorIndex(0);
      setLastPhase(progress.phase);
    }
  }, [progress.phase, lastPhase]);

  // Update display message from SSE or use current message
  useEffect(() => {
    if (progress.message) {
      setDisplayMessage(progress.message);
    }
  }, [progress.message]);

  // Rotate flavor text every 5 seconds if on same phase
  useEffect(() => {
    const flavorTexts = FLAVOR_TEXT_BY_PHASE[progress.phase] || [];
    if (flavorTexts.length <= 1) return;

    const timer = setInterval(() => {
      setFlavorIndex((prev) => {
        const next = (prev + 1) % flavorTexts.length;
        setDisplayMessage(flavorTexts[next]);
        return next;
      });
    }, 5000);

    return () => clearInterval(timer);
  }, [progress.phase]);

  return (
    <div className="fixed inset-0 flex items-start justify-center pt-[25vh]">
      <div className="text-center space-y-6 max-w-md mx-auto px-4">
        {/* Spinner */}
        <div className="relative w-16 h-16 mx-auto">
          <div className="absolute inset-0 rounded-full border-4 border-blue-200/30" />
          <div className="absolute inset-0 rounded-full border-4 border-t-blue-600 border-r-blue-600 border-b-transparent border-l-transparent animate-spin" />
        </div>

        {/* Message */}
        <div className="space-y-2">
          <p className="text-2xl md:text-3xl font-semibold text-gray-900 dark:text-gray-100 animate-fade-in">
            {displayMessage}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
            {progress.phase === "complete" ? "Done" : progress.phase}
          </p>
        </div>
      </div>
    </div>
  );
}