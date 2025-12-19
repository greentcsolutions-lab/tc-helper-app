// src/lib/pdf/renderer.ts
// Version: 3.5.0 - 2025-12-19
// FIXED: Preserve original DPI metadata when cropping footer strips with Sharp
// ADDED: dpi option passed through to downloadAndExtractZip for metadata preservation
// IMPROVED: Better logging for DPI handling

import { bufferToBlob } from "@/lib/utils";
import { put } from "@vercel/blob";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";

if (!process.env.NUTRIENT_API_KEY?.trim()) {
  throw new Error("NUTRIENT_API_KEY missing in .env.local");
}

const NUTRIENT_ENDPOINT = "https://api.nutrient.io/build";

export interface RenderResult {
  url: string;
  key: string;
}

export interface RenderOptions {
  maxPages?: number;
  pages?: number[];
  dpi?: number;
  footerOnly?: boolean;
  totalPages?: number; // Pass total page count for classification (all pages)
}

/**
 * Detect page dimensions (used for logging and footer crop calculation)
 */
async function detectPageSize(buffer: Buffer): Promise<{ width: number; height: number }> {
  try {
    const pdfDoc = await PDFDocument.load(buffer);
    const firstPage = pdfDoc.getPage(0);
    const { width, height } = firstPage.getSize();
    
    console.log(`[Nutrient] Detected page size: ${width}pt × ${height}pt (${(width/72).toFixed(1)}" × ${(height/72).toFixed(1)}")`);
    
    return { width, height };
  } catch (error) {
    console.warn("[Nutrient] Failed to detect page size, using US Letter default:", error);
    return { width: 612, height: 792 };
  }
}

/**
 * Renders PDF to PNG ZIP and uploads to Vercel Blob
 */
export async function renderPdfToPngZipUrl(
  buffer: Buffer,
  options: RenderOptions = {}
): Promise<RenderResult> {
  const { maxPages, pages, dpi = 290, footerOnly = false, totalPages } = options;
  const key = `renders/${Date.now()}-${crypto.randomUUID()}.zip`;

  console.log("[Nutrient] Render config:", {
    fileSizeBytes: buffer.length,
    dpi,
    maxPages,
    pages: pages || "all",
    footerOnly,
    totalPages,
    blobKey: key,
  });

  if (!buffer.subarray(0, 8).toString().includes("%PDF")) {
    throw new Error("Invalid PDF");
  }

  const form = new FormData();
  form.append("document", bufferToBlob(buffer, "application/pdf"), "document.pdf");

  let instructions: any = {
    parts: [{ file: "document" }],
    actions: [{ type: "flatten" }],
    output: {
      type: "image",
      format: "png",
      dpi,
    },
  };

  // Force per-page PNGs in ZIP for multi-page docs
  const renderPageCount = pages?.length || maxPages || totalPages;
  if (renderPageCount && renderPageCount > 1) {
    instructions.output.pages = {
      start: 0,
      end: renderPageCount - 1,
    };
    console.log(`[Nutrient] Forcing per-page PNGs: output.pages { start: 0, end: ${renderPageCount - 1} }`);
  }

  // Log footer mode
  if (footerOnly) {
    const { height } = await detectPageSize(buffer);
    const footerHeightPt = Math.round(height * 0.15);
    console.log(`[Nutrient] footerOnly=true → will crop to bottom ~${footerHeightPt}pt with sharp after render`);
  }

  // Specific pages mode
  if (pages && pages.length > 0) {
    instructions.parts = pages.map((pageNum) => ({
      file: "document",
      pages: {
        start: pageNum - 1,
        end: pageNum - 1,
      },
    }));
    delete instructions.output.pages;
  }

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

    console.log("[Nutrient] Success → buffering full ZIP before Blob upload");

    const arrayBuffer = await res.arrayBuffer();
    const zipBuffer = Buffer.from(arrayBuffer);

    const magicBytes = zipBuffer.subarray(0, 4);
    const isZip =
      magicBytes[0] === 0x50 &&
      magicBytes[1] === 0x4B &&
      (magicBytes[2] === 0x03 || magicBytes[2] === 0x05) &&
      (magicBytes[3] === 0x04 || magicBytes[3] === 0x06);

    if (!isZip) {
      throw new Error("Nutrient returned invalid format (not a ZIP)");
    }

    console.log("[Nutrient] ✓ Valid ZIP → uploading to Blob");

    const { url } = await put(key, zipBuffer, {
      access: "public",
      multipart: true,
      addRandomSuffix: false,
    });

    const modeDesc = footerOnly ? "full pages (footer crop via sharp)" :
                     pages ? `pages [${pages.join(", ")}]` :
                     maxPages ? `first ${maxPages} pages` :
                     "all pages";
    
    console.log(`[Nutrient] Complete: ${modeDesc} @ ${dpi} DPI → ${key}`);
    return { url, key };
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error("[Nutrient] FAILED:", error.message);
    throw error;
  }
}

/**
 * Download ZIP from Blob and extract PNG array
 * When footerOnly=true, crops each PNG to bottom 15% and preserves original DPI metadata
 */
export async function downloadAndExtractZip(
  zipUrl: string,
  options: RenderOptions = {}
): Promise<{ pageNumber: number; base64: string }[]> {
  const JSZip = (await import("jszip")).default;

  console.log("[ZIP Download] Fetching from Blob:", zipUrl);
  const res = await fetch(zipUrl);
  if (!res.ok) throw new Error(`Failed to download ZIP: ${res.status}`);

  const arrayBuffer = await res.arrayBuffer();
  const downloadedBuffer = Buffer.from(arrayBuffer);

  const magicBytes = downloadedBuffer.subarray(0, 4);
  const isZip =
    magicBytes[0] === 0x50 &&
    magicBytes[1] === 0x4B &&
    (magicBytes[2] === 0x03 || magicBytes[2] === 0x05) &&
    (magicBytes[3] === 0x04 || magicBytes[3] === 0x06);

  if (!isZip) {
    throw new Error("Downloaded file from Blob is not a valid ZIP");
  }

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
      let buffer = await file.async("nodebuffer");

      if (options.footerOnly) {
        const image = sharp(buffer);
        const metadata = await image.metadata();

        // Preserve original density from Nutrient render
        // Fallback chain: input metadata → options.dpi → 160
        const targetDpi = metadata.density ?? options.dpi ?? 160;

        const footerHeight = Math.round(metadata.height! * 0.15);

        if (footerHeight > 0 && metadata.width && metadata.height) {
          buffer = await image
            .extract({
              left: 0,
              top: metadata.height - footerHeight,
              width: metadata.width,
              height: footerHeight,
            })
            .withMetadata({ density: targetDpi }) // ← Preserves DPI in output PNG metadata
            .toBuffer();

          console.log(`[sharp] Cropped page ${i + 1} to bottom ${footerHeight}px @ ${targetDpi} DPI preserved`);
        }
      }

      return {
        pageNumber: i + 1,
        base64: `data:image/png;base64,${buffer.toString("base64")}`,
      };
    })
  );

  console.log(`[ZIP Extract] Loaded ${pages.length} pages from ${zipUrl}${options.footerOnly ? " (footer strips with DPI preserved)" : ""}`);
  return pages;
}