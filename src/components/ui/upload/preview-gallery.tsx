"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { PreviewPage } from "./types";
import ImageModal from "@/components/ui/image-modal";

type PreviewGalleryProps = {
  pages: PreviewPage[];
  onLoaded: (count: number) => void;
};

export function PreviewGallery({ pages, onLoaded }: PreviewGalleryProps) {
  const [selected, setSelected] = useState<PreviewPage | null>(null);

  onLoaded(pages.length);

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 animate-in fade-in duration-500">
        {pages.map((page) => (
          <Card
            key={page.pageNumber}
            className="overflow-hidden cursor-zoom-in hover:ring-2 hover:ring-primary transition-all"
            onClick={() => setSelected(page)}
          >
            <div className="bg-muted p-2 text-center text-xs font-medium">
              Critical Page {page.pageNumber}
            </div>
            <div className="aspect-[8.5/11] relative overflow-hidden bg-gray-100">
              <img
                src={page.base64}
                alt={`Page ${page.pageNumber}`}
                className="w-full h-full object-contain"
              />
            </div>
          </Card>
        ))}
        {pages.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground">
            Identifying critical pages...
          </div>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-5xl">
          {/* ← THIS IS THE ONLY NEW LINE */}
          <DialogTitle className="sr-only">Full Page Preview</DialogTitle>

          {selected && (
            <ImageModal
              src={selected.base64}
              alt={`Page ${selected.pageNumber} full size`}
              open={!!selected}
              onOpenChange={() => setSelected(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}