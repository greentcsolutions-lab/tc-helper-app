// src/components/ui/upload/preview-gallery.tsx
// Version: 3.0.1 - 2025-12-30
// FIX: Better error logging to debug preview issues

"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import JSZip from "jszip";
import ImageModal from "@/components/ui/image-modal";

type PreviewPage = {
  pageNumber: number;
  base64: string;
};

type PreviewGalleryProps = {
  parseId: string;
};

const BLUR_PLACEHOLDER =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

export function PreviewGallery({ parseId }: PreviewGalleryProps) {
  const [pages, setPages] = useState<PreviewPage[]>([]);
  const [selected, setSelected] = useState<PreviewPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!parseId) {
      console.error('[PreviewGallery] ❌ No parseId provided');
      setError('No parse ID provided');
      setLoading(false);
      return;
    }

    async function loadCriticalPages() {
      try {
        setLoading(true);
        setError(null);
        
        // STEP 1: Get critical page numbers and ZIP URL from preview endpoint
        console.log(`[PreviewGallery] 🔍 Fetching preview data for parse ${parseId}`);
        const previewRes = await fetch(`/api/parse/preview/${parseId}`);
        
        console.log(`[PreviewGallery] Preview response status: ${previewRes.status}`);
        
        if (!previewRes.ok) {
          const errorData = await previewRes.json();
          console.error(`[PreviewGallery] ❌ Preview endpoint error:`, errorData);
          throw new Error(errorData.error || errorData.hint || "Failed to load preview data");
        }
        
        const previewData = await previewRes.json();
        console.log(`[PreviewGallery] ✓ Preview data received:`, {
          hasZipUrl: !!previewData.zipUrl,
          criticalPageCount: previewData.criticalPageNumbers?.length || 0,
          totalPages: previewData.totalPages
        });
        
        const { zipUrl, criticalPageNumbers } = previewData;
        
        if (!zipUrl) {
          console.error(`[PreviewGallery] ❌ No ZIP URL in response`);
          throw new Error("Preview ZIP URL not available");
        }
        
        if (!criticalPageNumbers || criticalPageNumbers.length === 0) {
          console.warn(`[PreviewGallery] ⚠️ No critical pages identified`);
          throw new Error("No critical pages identified");
        }
        
        console.log(`[PreviewGallery] 📋 Critical pages to show: [${criticalPageNumbers.join(', ')}]`);
        console.log(`[PreviewGallery] 🔗 ZIP URL: ${zipUrl}`);
        
        // STEP 2: Download and extract ZIP
        console.log(`[PreviewGallery] 📥 Downloading ZIP from Vercel Blob...`);
        const res = await fetch(zipUrl);
        
        if (!res.ok) {
          console.error(`[PreviewGallery] ❌ Failed to fetch ZIP: ${res.status}`);
          throw new Error(`Failed to fetch ZIP (${res.status})`);
        }
        
        console.log(`[PreviewGallery] ✓ ZIP downloaded, extracting...`);
        const buffer = await res.arrayBuffer();
        const zip = await JSZip.loadAsync(buffer);

        // STEP 3: Get all PNG files and sort by filename number
        const allPngFiles = Object.keys(zip.files)
          .filter((k) => k.match(/\.png$/i))
          .sort((a, b) => {
            const aNum = parseInt(a.match(/(\d+)\.png$/)?.[1] || "0");
            const bNum = parseInt(b.match(/(\d+)\.png$/)?.[1] || "0");
            return aNum - bNum;
          });

        console.log(`[PreviewGallery] 📦 Found ${allPngFiles.length} total PNGs in ZIP`);
        console.log(`[PreviewGallery] 📄 Files in ZIP:`, allPngFiles.slice(0, 5).join(', '), '...');

        const loadedPages: PreviewPage[] = [];

        // STEP 4: Load ONLY the critical pages
        for (const filename of allPngFiles) {
          // Extract the PNG index from filename (0.png → 0, 10.png → 10)
          const pngIndex = parseInt(filename.match(/(\d+)\.png$/i)?.[1] || "0");
          const pageNumber = pngIndex + 1; // Convert to 1-indexed PDF page number
          
          // CRITICAL: Only load if this page is in the critical pages list
          if (!criticalPageNumbers.includes(pageNumber)) {
            continue;
          }
          
          const file = zip.file(filename);
          if (!file) {
            console.warn(`[PreviewGallery] ⚠️ Could not access file ${filename} in ZIP`);
            continue;
          }
          
          console.log(`[PreviewGallery] 🖼️  Loading critical page ${pageNumber} from ${filename}...`);
          const data = await file.async("arraybuffer");
          
          loadedPages.push({
            pageNumber,
            base64: `data:image/png;base64,${Buffer.from(data).toString("base64")}`,
          });
          
          console.log(`[PreviewGallery] ✓ Loaded page ${pageNumber} (${(data.byteLength / 1024).toFixed(1)} KB)`);
        }

        // Sort by page number to display in order
        loadedPages.sort((a, b) => a.pageNumber - b.pageNumber);
        
        console.log(`[PreviewGallery] ✅ Successfully loaded ${loadedPages.length} critical pages`);
        console.log(`[PreviewGallery] 📊 Page numbers: [${loadedPages.map(p => p.pageNumber).join(', ')}]`);

        if (loadedPages.length === 0) {
          console.error(`[PreviewGallery] ❌ No pages were loaded (had ${criticalPageNumbers.length} expected)`);
          throw new Error("No preview images could be loaded from ZIP");
        }

        setPages(loadedPages);
      } catch (err: any) {
        console.error("[PreviewGallery] ❌ Failed to load preview:", err);
        console.error("[PreviewGallery] Error details:", err.message, err.stack);
        setError(err.message || "Failed to load preview");
      } finally {
        setLoading(false);
      }
    }

    loadCriticalPages();
  }, [parseId]);

  if (loading) {
    return (
      <div className="col-span-full py-12 text-center text-muted-foreground">
        <p className="mb-2">Loading critical pages preview...</p>
        <p className="text-xs">This may take a moment while downloading images</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="col-span-full py-12 text-center">
        <p className="text-destructive font-medium mb-2">Failed to load preview</p>
        <p className="text-sm text-muted-foreground mb-4">{error}</p>
        <p className="text-xs text-muted-foreground">
          Check the browser console for detailed error logs
        </p>
      </div>
    );
  }

  if (pages.length === 0) {
    return (
      <div className="col-span-full py-12 text-center text-muted-foreground">
        <p className="mb-2">No critical pages found</p>
        <p className="text-xs">The classifier may not have identified any critical pages</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 animate-in fade-in duration-500">
        {pages.map((page, i) => (
          <Card
            key={page.pageNumber}
            className="overflow-hidden cursor-zoom-in hover:ring-2 hover:ring-primary transition-all"
            onClick={() => setSelected(page)}
          >
            <div className="bg-muted p-2 text-center text-xs font-medium">
              Page {page.pageNumber}
            </div>
            <div className="aspect-[8.5/11] relative bg-gray-100">
              <Image
                src={page.base64}
                alt={`Page ${page.pageNumber}`}
                fill
                className="object-contain"
                loading={i < 3 ? "eager" : "lazy"}
                placeholder="blur"
                blurDataURL={BLUR_PLACEHOLDER}
                sizes="(max-width: 768px) 50vw, 33vw"
                unoptimized
              />
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-5xl">
          <DialogTitle className="sr-only">Full Page Preview</DialogTitle>
          {selected && (
            <ImageModal
              src={selected.base64}
              alt={`Page ${selected.pageNumber}`}
              open={!!selected}
              onOpenChange={() => setSelected(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}