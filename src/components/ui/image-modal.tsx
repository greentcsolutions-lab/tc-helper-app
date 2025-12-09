"use client";

import * as React from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// Tiny blur placeholder
const BLUR_PLACEHOLDER =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

interface ImageModalProps {
  src: string;
  alt?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
}

function ImageModal({
  src,
  alt = "Document page",
  open,
  onOpenChange,
  className,
}: ImageModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-w-none w-screen h-screen p-0 overflow-hidden bg-black/95",
          className
        )}
      >
        <DialogTitle className="sr-only">Document Preview</DialogTitle>

        {/* Close button */}
        <DialogHeader className="absolute right-4 top-4 z-50">
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
            aria-label="Close"
          >
            <X className="h-6 w-6" />
          </button>
        </DialogHeader>

        {/* Full-screen image with blur placeholder */}
        <div className="relative w-full h-full flex items-center justify-center">
          <Image
            src={src}
            alt={alt}
            fill
            className="object-contain"
            unoptimized
            priority
            placeholder="blur"
            blurDataURL={BLUR_PLACEHOLDER}
          />
        </div>

        {/* Optional page label overlay */}
        {alt && alt !== "Document page" && (
          <div className="absolute bottom-6 left-6 z-50">
            <p className="text-white/90 text-sm font-medium bg-black/50 px-3 py-1.5 rounded-md backdrop-blur-sm">
              {alt}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default ImageModal;