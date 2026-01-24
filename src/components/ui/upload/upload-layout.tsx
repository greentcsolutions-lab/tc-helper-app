// src/components/ui/upload/upload-layout.tsx
// Client component wrapper for upload page with slide animations
"use client";

import { ReactNode, createContext, useContext, useState, useEffect } from "react";

type UploadLayoutContextType = {
  isProcessing: boolean;
  isComplete: boolean;
  setIsProcessing: (processing: boolean) => void;
  setIsComplete: (complete: boolean) => void;
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
  const [isComplete, setIsComplete] = useState(false);

  // Hide navigation sidebar when processing or showing results
  useEffect(() => {
    const navSidebar = document.querySelector('[data-nav-sidebar]');
    const mainContent = document.querySelector('[data-main-content]');

    if (isProcessing || isComplete) {
      // Hide navigation sidebar
      if (navSidebar) {
        (navSidebar as HTMLElement).style.display = 'none';
      }
      // Remove left padding from main content
      if (mainContent) {
        mainContent.classList.remove('lg:pl-64');
      }
    } else {
      // Show navigation sidebar
      if (navSidebar) {
        (navSidebar as HTMLElement).style.display = '';
      }
      // Restore left padding to main content
      if (mainContent) {
        mainContent.classList.add('lg:pl-64');
      }
    }

    // Cleanup on unmount
    return () => {
      if (navSidebar) {
        (navSidebar as HTMLElement).style.display = '';
      }
      if (mainContent) {
        mainContent.classList.add('lg:pl-64');
      }
    };
  }, [isProcessing, isComplete]);

  // Hide sidebar when processing OR complete
  const shouldHideSidebar = isProcessing || isComplete;

  return (
    <UploadLayoutContext.Provider value={{ isProcessing, isComplete, setIsProcessing, setIsComplete }}>
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Upload Area - 2/3 width, expands to full when sidebar hidden */}
        <div
          className={`lg:col-span-2 transition-all duration-500 ease-in-out ${
            shouldHideSidebar ? "lg:col-span-3" : ""
          }`}
        >
          {mainContent}
        </div>

        {/* Sidebar - slides out when processing/complete and stays hidden */}
        <div
          className={`space-y-6 transition-all duration-500 ease-in-out ${
            shouldHideSidebar ? "opacity-0 translate-x-full pointer-events-none lg:hidden" : "opacity-100 translate-x-0"
          }`}
        >
          {sidebar}
        </div>
      </div>
    </UploadLayoutContext.Provider>
  );
}
