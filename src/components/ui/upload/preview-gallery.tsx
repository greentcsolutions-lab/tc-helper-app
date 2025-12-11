// src/components/upload/preview-gallery.tsx
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
  zipUrl: string;
  maxPages?: number;
};

const BLUR_PLACEHOLDER =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

export function PreviewGallery({ zipUrl, maxPages = 9 }: PreviewGalleryProps) {
  const [pages, setPages] = useState<PreviewPage[]>([]);
  const [selected, setSelected] = useState<PreviewPage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!zipUrl) return;

    async function loadZip() {
      try {
        setLoading(true);
        const res = await fetch(zipUrl);
        if (!res.ok) throw new Error("Failed to fetch ZIP");

        const buffer = await res.arrayBuffer();
        const zip = await JSZip.loadAsync(buffer);

        const keys = Object.keys(zip.files)
          .filter((k) => k.match(/\.png$/i))
          .sort((a, b) => {
            const aNum = parseInt(a.match(/(\d+)\.png$/)?.[1] || "0");
            const bNum = parseInt(b.match(/(\d+)\.png$/)?.[1] || "0");
            return aNum - bNum;
          })
          .slice(0, maxPages);

        const loadedPages: PreviewPage[] = [];

        for (const [i, key] of keys.entries()) {
          const file = zip.file(key);
          if (!file) continue;
          const data = await file.async("arraybuffer");
          loadedPages.push({
            pageNumber: i + 1,
            base64: `data:image/png;base64,${Buffer.from(data).toString("base64")}`,
          });
        }

        setPages(loadedPages);
      } catch (err) {
        console.error("Failed to load preview:", err);
      } finally {
        setLoading(false);
      }
    }

    loadZip();
  }, [zipUrl, maxPages]);

  if (loading) {
    return (
      <div className="col-span-full py-12 text-center text-muted-foreground">
        Loading preview...
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