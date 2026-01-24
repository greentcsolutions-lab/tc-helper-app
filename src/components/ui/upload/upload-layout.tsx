// src/components/ui/upload/upload-layout.tsx
// Client component wrapper for upload page with slide animations
"use client";

import { ReactNode, createContext, useContext, useState } from "react";

type UploadLayoutContextType = {
  isProcessing: boolean;
  setIsProcessing: (processing: boolean) => void;
};

const UploadLayoutContext = createContext<UploadLayoutContextType | null>(null);

export function useUploadLayout() {
  const context = useContext(UploadLayoutContext);
  if (!context) {
    throw new Error("useUploadLayout must be used within UploadLayoutProvider");
  }
  return context;
}

type UploadLayoutProps = {
  mainContent: ReactNode;
  sidebar: ReactNode;
};

export function UploadLayout({ mainContent, sidebar }: UploadLayoutProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  return (
    <UploadLayoutContext.Provider value={{ isProcessing, setIsProcessing }}>
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Upload Area - 2/3 width */}
        <div
          className={`lg:col-span-2 transition-all duration-500 ease-in-out ${
            isProcessing ? "lg:col-span-3" : ""
          }`}
        >
          {mainContent}
        </div>

        {/* Sidebar - slides out when processing */}
        <div
          className={`space-y-6 transition-all duration-500 ease-in-out ${
            isProcessing ? "opacity-0 translate-x-full pointer-events-none lg:hidden" : "opacity-100 translate-x-0"
          }`}
        >
          {sidebar}
        </div>
      </div>
    </UploadLayoutContext.Provider>
  );
}
