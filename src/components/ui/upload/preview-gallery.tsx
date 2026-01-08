// src/components/ui/upload/preview-gallery.tsx
// Version: 4.1.0 - 2026-01-07
// FIXED: Removed invalid pageLayout prop causing TS error 2769
// FIXED: Removed implicit any by deleting unused renderPage callback
// Now uses simple small-scale Viewer for thumbnails (efficient via byte ranges)
// Modal uses full default-layout viewer

"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Worker } from "@react-pdf-viewer/core";
import { Viewer } from "@react-pdf-viewer/core";
import { defaultLayoutPlugin } from "@react-pdf-viewer/default-layout";

// Import styles
import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/default-layout/lib/styles/index.css";

type PreviewGalleryProps = {
  parseId: string;
  criticalPages: number[];
};

const PDF_WORKER_URL = "https://unpkg.com/pdfjs-dist@4.0.379/build/pdf.worker.mjs";

export function PreviewGallery({ parseId, criticalPages }: PreviewGalleryProps) {
  const [selectedPage, setSelectedPage] = useState<number | null>(null);

  const defaultLayoutPluginInstance = defaultLayoutPlugin();

  if (criticalPages.length === 0) {
    return (
      <div className="col-span-full py-12 text-center text-muted-foreground">
        <p className="mb-2">No substantive pages identified yet</p>
        <p className="text-xs">Extraction is still running...</p>
      </div>
    );
  }

  const pdfUrl = `/api/parse/preview/${parseId}`;

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 animate-in fade-in duration-500">
        {criticalPages.map((pageNumber) => (
          <Card
            key={pageNumber}
            className="overflow-hidden cursor-zoom-in hover:ring-2 hover:ring-primary transition-all"
            onClick={() => setSelectedPage(pageNumber)}
          >
            <div className="bg-muted p-2 text-center text-xs font-medium">
              Page {pageNumber}
            </div>
            <div className="aspect-[8.5/11] relative bg-gray-100 overflow-hidden">
              <Worker workerUrl={PDF_WORKER_URL}>
                <Viewer
                  fileUrl={pdfUrl}
                  defaultScale={0.25} // Small crisp thumbnail
                  // No plugins needed for simple thumbnail
                />
              </Worker>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={!!selectedPage} onOpenChange={() => setSelectedPage(null)}>
        <DialogContent className="max-w-5xl h-[90vh] p-0">
          <DialogTitle className="sr-only">
            Page {selectedPage} – Full Preview
          </DialogTitle>
          {selectedPage && (
            <Worker workerUrl={PDF_WORKER_URL}>
              <div className="h-full">
                <Viewer
                  fileUrl={pdfUrl}
                  plugins={[defaultLayoutPluginInstance]}
                  // Optional: scroll to selected page on open
                  // The default-layout toolbar handles page navigation perfectly
                />
              </div>
            </Worker>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}