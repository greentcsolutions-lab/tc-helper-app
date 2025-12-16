// src/lib/pdf/renderer.ts
// Version 2.3.0 - Works with exact pageCount via maxPages from process route
// OPTIMIZED: Supports low-DPI classification + high-DPI selective extraction
// Uses correct Nutrient API format for page selection

import { bufferToBlob } from "@/lib/utils";
import { put } from "@vercel/blob";

if (!process.env.NUTRIENT_API_KEY?.trim()) {
  throw new Error("NUTRIENT_API_KEY missing in .env.local");
}

const NUTRIENT_ENDPOINT = "https://api.nutrient.io/build";

export interface RenderResult {
  url: string;
  key: string;
}

export interface RenderOptions {
  maxPages?: number;      // First N pages only → now used with exact pageCount for all-pages
  pages?: number[];       // Specific page numbers (1-indexed) - renders ONLY these pages
  dpi?: number;          // Default 290 for high quality, use 100 for classification
}

/**
 * Renders PDF to PNG ZIP and uploads to Vercel Blob
 * Supports three modes for cost optimization:
 *
 * 1. Preview (first N pages at high DPI):
 *    { maxPages: 9, dpi: 290 }
 *
 * 2. Classification (all pages at low DPI):
 *    { dpi: 100, maxPages: exactPageCount }
 *
 * 3. Extraction (specific pages at high DPI):
 *    { pages: [3, 8, 15, 42], dpi: 290 }
 */
export async function renderPdfToPngZipUrl(
  buffer: Buffer,
  options: RenderOptions = {}
): Promise<RenderResult> {
  const { maxPages, pages, dpi = 290 } = options;
  const key = `renders/${Date.now()}-${crypto.randomUUID()}.zip`;

  console.log("[Nutrient] Render config:", {
    fileSizeBytes: buffer.length,
    dpi,
    maxPages,
    specificPages: pages?.length || "all",
    blobKey: key,
  });

  if (!buffer.subarray(0, 8).toString().includes("%PDF")) {
    throw new Error("Invalid PDF");
  }

  const form = new FormData();
  form.append("document", bufferToBlob(buffer, "application/pdf"), "document.pdf");

  // Build Nutrient instructions based on mode
  let instructions: any = {
    parts: [{ file: "document" }],
    actions: [{ type: "flatten" }],
    output: {
      type: "image",
      format: "png",
      dpi,
    },
  };

  if (pages && pages.length > 0) {
    // MODE 3: Specific pages only
    instructions.parts = pages.map((pageNum) => ({
      file: "document",
      pages: {
        start: pageNum - 1,
        end: pageNum - 1,
      },
    }));
  } else if (maxPages) {
    // MODE 1 & 2: Exact range (preview or all pages)
    instructions.output.pages = {
      start: 0,
      end: maxPages - 1,
    };
  }
  // No else needed - omitting output.pages entirely defaults to single page (we avoid this now)

  form.append("instructions", JSON.stringify(instructions));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000);

  try {
    const res = await fetch(NUTRIENT_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.NUTRIENT_API_KEY!}`,
      },
      body: form,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Nutrient failed: ${res.status} ${text}`);
    }

    console.log("[Nutrient] Success → buffering full response before Blob upload");

    const arrayBuffer = await res.arrayBuffer();
    const responseBuffer = Buffer.from(arrayBuffer);

    console.log("[Nutrient] Response buffered:", responseBuffer.length, "bytes");

    const { url } = await put(key, responseBuffer, {
      access: "public",
      multipart: true,
      addRandomSuffix: false,
    });

    const pagesInfo = pages ? `pages [${pages.join(", ")}]` :
                     maxPages ? `first ${maxPages} pages (exact)` :
                     "all pages";
    console.log(`[Nutrient] Complete: ${pagesInfo} @ ${dpi} DPI → ${key}`);
    return { url, key };
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error("[Nutrient] FAILED:", error.message);
    throw error;
  }
}

/**
 * Helper: Download ZIP from Blob and extract PNG array
 * Returns array of { pageNumber, base64 } for immediate use
 */
export async function downloadAndExtractZip(
  zipUrl: string
): Promise<{ pageNumber: number; base64: string }[]> {
  const JSZip = (await import("jszip")).default;

  const res = await fetch(zipUrl);
  if (!res.ok) throw new Error("Failed to download ZIP");

  const arrayBuffer = await res.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  const pngFiles = Object.keys(zip.files)
    .filter((name) => name.match(/\.png$/i))
    .sort((a, b) => {
      const aNum = parseInt(a.match(/(\d+)\.png$/i)?.[1] || "0");
      const bNum = parseInt(b.match(/(\d+)\.png$/i)?.[1] || "0");
      return aNum - bNum;
    });

  if (pngFiles.length === 0) throw new Error("No PNGs in ZIP");

  const pages = await Promise.all(
    pngFiles.map(async (name, i) => {
      const file = zip.file(name)!;
      const buffer = await file.async("nodebuffer");
      return {
        pageNumber: i + 1,
        base64: `data:image/png;base64,${buffer.toString("base64")}`,
      };
    })
  );

  console.log(`[ZIP Extract] Loaded ${pages.length} pages from ${zipUrl}`);
  return pages;
}
