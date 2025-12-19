// src/lib/pdf/renderer.ts
// Version: 3.1.0 - 2025-12-19
// Added footer-only rendering mode with dynamic page size detection
// OPTIMIZED: Supports low-DPI classification + high-DPI selective extraction

import { bufferToBlob } from "@/lib/utils";
import { put } from "@vercel/blob";
import { PDFDocument } from "pdf-lib";

if (!process.env.NUTRIENT_API_KEY?.trim()) {
  throw new Error("NUTRIENT_API_KEY missing in .env.local");
}

const NUTRIENT_ENDPOINT = "https://api.nutrient.io/build";

export interface RenderResult {
  url: string;
  key: string;
}

export interface RenderOptions {
  maxPages?: number;      // First N pages only
  pages?: number[];       // Specific page numbers (1-indexed) - renders ONLY these pages
  dpi?: number;           // Default 290 for high quality, use 160 for classification
  footerOnly?: boolean;   // NEW: Crop to bottom 15% (footer region only)
}

/**
 * Detect page dimensions for proper footer cropping
 * Returns { width, height } in points (72 points = 1 inch)
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
    // Default to US Letter (8.5" × 11" = 612pt × 792pt)
    return { width: 612, height: 792 };
  }
}

/**
 * Calculate footer crop region (bottom 15% of page)
 * Returns Nutrient crop action with dynamic coordinates
 */
function calculateFooterCrop(pageWidth: number, pageHeight: number) {
  const FOOTER_PERCENTAGE = 0.15;
  const footerHeight = Math.round(pageHeight * FOOTER_PERCENTAGE);
  const cropTop = Math.round(pageHeight - footerHeight);
  
  return {
    type: "crop",
    left: 0,
    top: cropTop,
    width: Math.round(pageWidth),
    height: footerHeight,
  };
}

/**
 * Renders PDF to PNG ZIP and uploads to Vercel Blob
 * Supports four modes for cost optimization:
 *
 * 1. Preview (first N pages at high DPI):
 *    { maxPages: 9, dpi: 290 }
 *
 * 2. Classification (all pages, footer-only at low DPI):
 *    { dpi: 160, footerOnly: true }
 *
 * 3. Extraction (specific pages at high DPI):
 *    { pages: [3, 8, 15, 42], dpi: 290 }
 *
 * 4. Full render (all pages at specified DPI):
 *    { dpi: 290 }
 */
export async function renderPdfToPngZipUrl(
  buffer: Buffer,
  options: RenderOptions = {}
): Promise<RenderResult> {
  const { maxPages, pages, dpi = 290, footerOnly = false } = options;
  const key = `renders/${Date.now()}-${crypto.randomUUID()}.zip`;

  console.log("[Nutrient] Render config:", {
    fileSizeBytes: buffer.length,
    dpi,
    maxPages,
    pages: pages || "all",
    footerOnly,
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

  // NEW: Add footer crop action BEFORE flatten
  if (footerOnly) {
    const { width, height } = await detectPageSize(buffer);
    const cropAction = calculateFooterCrop(width, height);
    
    // Insert crop action BEFORE flatten
    instructions.actions.unshift(cropAction);
    
    console.log(`[Nutrient] Footer-only mode: cropping to bottom ${Math.round(cropAction.height)}pt (15% of ${height}pt page)`);
  }

  if (pages && pages.length > 0) {
    // MODE 3: Specific pages only
    instructions.parts = pages.map((pageNum) => ({
      file: "document",
      pages: {
        start: pageNum - 1,  // 0-indexed
        end: pageNum - 1,
      },
    }));
  } else if (maxPages) {
    // MODE 1: First N pages
    instructions.output.pages = {
      start: 0,
      end: maxPages - 1,
    };
  }
  // MODE 2 & 4: All pages → no pages restriction

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

    // Fully consume the stream into a Buffer first → avoids corruption/truncation
    const arrayBuffer = await res.arrayBuffer();
    const zipBuffer = Buffer.from(arrayBuffer);

    // VALIDATION: Check if this is actually a ZIP file (magic bytes: 50 4B 03 04)
    const magicBytes = zipBuffer.subarray(0, 4);
    const isZip =
      magicBytes[0] === 0x50 &&
      magicBytes[1] === 0x4B &&
      (magicBytes[2] === 0x03 || magicBytes[2] === 0x05) &&
      (magicBytes[3] === 0x04 || magicBytes[3] === 0x06);

    console.log("[Nutrient] File validation:", {
      size: zipBuffer.length,
      magicBytes: Array.from(magicBytes).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' '),
      isZip,
      firstChars: zipBuffer.subarray(0, 20).toString('utf8', 0, 20).replace(/[^\x20-\x7E]/g, '.'),
    });

    if (!isZip) {
      // Check if it's Base64
      const asText = zipBuffer.toString('utf8').substring(0, 100);
      const isBase64 = /^[A-Za-z0-9+/]+=*$/.test(asText.replace(/\s/g, ''));

      console.error("[Nutrient] NOT A ZIP FILE!", {
        possiblyBase64: isBase64,
        contentStart: asText,
      });

      throw new Error(
        `Nutrient returned invalid format (not a ZIP). ` +
        `Got ${magicBytes.length} bytes starting with ${magicBytes[0].toString(16)}. ` +
        `Possibly Base64: ${isBase64}`
      );
    }

    console.log("[Nutrient] ✓ Valid ZIP file → uploading to Blob");

    const { url } = await put(key, zipBuffer, {
      access: "public",
      multipart: true,
      addRandomSuffix: false,
    });

    const modeDesc = footerOnly ? "footer strips" :
                     pages ? `pages [${pages.join(", ")}]` :
                     maxPages ? `first ${maxPages} pages (exact)` :
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
 * Helper: Download ZIP from Blob and extract PNG array
 * Returns array of { pageNumber, base64 } for immediate use
 */
export async function downloadAndExtractZip(
  zipUrl: string
): Promise<{ pageNumber: number; base64: string }[]> {
  const JSZip = (await import("jszip")).default;

  console.log("[ZIP Download] Fetching from Blob:", zipUrl);
  const res = await fetch(zipUrl);
  if (!res.ok) throw new Error(`Failed to download ZIP: ${res.status}`);

  const arrayBuffer = await res.arrayBuffer();
  const downloadedBuffer = Buffer.from(arrayBuffer);

  // VALIDATION: Check if download is actually a ZIP file
  const magicBytes = downloadedBuffer.subarray(0, 4);
  const isZip =
    magicBytes[0] === 0x50 &&
    magicBytes[1] === 0x4B &&
    (magicBytes[2] === 0x03 || magicBytes[2] === 0x05) &&
    (magicBytes[3] === 0x04 || magicBytes[3] === 0x06);

  console.log("[ZIP Download] File validation:", {
    size: downloadedBuffer.length,
    magicBytes: Array.from(magicBytes).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' '),
    isZip,
    firstChars: downloadedBuffer.subarray(0, 20).toString('utf8', 0, 20).replace(/[^\x20-\x7E]/g, '.'),
  });

  if (!isZip) {
    console.error("[ZIP Download] Downloaded file is NOT a ZIP!");
    throw new Error(
      `Downloaded file is not a ZIP. Got ${downloadedBuffer.length} bytes ` +
      `starting with [${Array.from(magicBytes).map(b => `0x${b.toString(16)}`).join(', ')}]`
    );
  }

  console.log("[ZIP Download] ✓ Valid ZIP file → parsing with JSZip");

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