// src/lib/pdf/renderer.ts
// Version: 3.7.0 - 2025-12-22
// MAJOR UPDATE: Made totalPages optional - Nutrient auto-detects if not provided
// MAINTAINED: Multi-page ZIP output guaranteed, sequential page mapping preserved

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
  maxPages?: number;
  pages?: number[];
  dpi?: number;
  totalPages?: number; // Now optional - undefined = Nutrient auto-detects
}

/**
 * Renders PDF to PNG ZIP and uploads to Vercel Blob
 * 
 * IMPORTANT: Always returns multi-page ZIP format when rendering multiple pages
 * - If totalPages provided: Uses it for output.pages configuration
 * - If totalPages undefined: Nutrient auto-detects all pages
 * - Result: ZIP with sequentially numbered PNGs (1.png, 2.png, ..., N.png)
 */
export async function renderPdfToPngZipUrl(
  buffer: Buffer,
  options: RenderOptions = {}
): Promise<RenderResult> {
  const { maxPages, pages, dpi = 300, totalPages } = options;
  const key = `renders/${Date.now()}-${crypto.randomUUID()}.zip`;

  console.log("[Nutrient] Render config:", {
    fileSizeBytes: buffer.length,
    dpi,
    maxPages,
    pages: pages ? `specific [${pages.join(", ")}]` : "all",
    totalPages: totalPages ?? "auto-detect",
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

  // SPECIFIC PAGES MODE (e.g., extracting only critical pages)
  if (pages && pages.length > 0) {
    console.log(`[Nutrient] Specific pages mode: extracting ${pages.length} pages`);
    instructions.parts = pages.map((pageNum) => ({
      file: "document",
      pages: {
        start: pageNum - 1,
        end: pageNum - 1,
      },
    }));
    // Note: This mode forces per-page output (ZIP) automatically
  } 
  // ALL PAGES OR SUBSET MODE
  else {
    // Determine how many pages to render
    let renderPageCount: number | null = null;
    
    if (maxPages) {
      // User wants first N pages only
      renderPageCount = maxPages;
    } else if (totalPages) {
      // We know total, render all
      renderPageCount = totalPages;
    }
    // else: renderPageCount = null → Nutrient auto-detects all pages

    // CRITICAL: Only specify output.pages if we have a count AND need multiple pages
    if (renderPageCount && renderPageCount > 1) {
      instructions.output.pages = {
        start: 0,
        end: renderPageCount - 1,
      };
      console.log(`[Nutrient] Forcing multi-page ZIP: pages 0-${renderPageCount - 1}`);
    } else if (renderPageCount === null) {
      // Auto-detect mode - Nutrient will return ZIP with all pages
      console.log(`[Nutrient] Auto-detect mode: Nutrient will determine page count`);
    }
    // Note: If renderPageCount === 1, Nutrient returns single PNG (not ZIP)
    // This is fine - our extractor handles it
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
      
      // Special handling for password-protected PDFs
      if (text.toLowerCase().includes("password") || 
          text.toLowerCase().includes("encrypted document")) {
        console.error("[Nutrient] Password-protected PDF detected");
        throw new Error("PDF_PASSWORD_PROTECTED");
      }
      
      console.error("[Nutrient] API error:", res.status, text);
      throw new Error(`Nutrient failed: ${res.status} ${text}`);
    }

    console.log("[Nutrient] Success → buffering response");

    const arrayBuffer = await res.arrayBuffer();
    const responseBuffer = Buffer.from(arrayBuffer);

    // Check if response is ZIP or single PNG
    const magicBytes = responseBuffer.subarray(0, 4);
    const isZip =
      magicBytes[0] === 0x50 &&
      magicBytes[1] === 0x4B &&
      (magicBytes[2] === 0x03 || magicBytes[2] === 0x05) &&
      (magicBytes[3] === 0x04 || magicBytes[3] === 0x06);

    const isPng = 
      magicBytes[0] === 0x89 &&
      magicBytes[1] === 0x50 &&
      magicBytes[2] === 0x4E &&
      magicBytes[3] === 0x47;

    if (!isZip && !isPng) {
      console.error("[Nutrient] Invalid response format - not ZIP or PNG");
      throw new Error("Nutrient returned invalid format (expected ZIP or PNG)");
    }

    const formatType = isZip ? "ZIP" : "PNG";
    console.log(`[Nutrient] ✓ Valid ${formatType} → uploading to Blob`);

    const { url } = await put(key, responseBuffer, {
      access: "public",
      multipart: true,
      addRandomSuffix: false,
    });

    const modeDesc = pages ? `pages [${pages.join(", ")}]` :
                     maxPages ? `first ${maxPages} pages` :
                     totalPages ? `all ${totalPages} pages` :
                     "all pages (auto-detected)";
    
    console.log(`[Nutrient] Complete: ${modeDesc} @ ${dpi} DPI → ${formatType} → ${key}`);
    return { url, key };
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    // Re-throw password-protected errors with user-friendly message
    if (error.message === "PDF_PASSWORD_PROTECTED") {
      throw new Error("This PDF is password-protected. Please provide an unlocked version or remove the password.");
    }
    
    console.error("[Nutrient] FAILED:", error.message);
    throw error;
  }
}

/**
 * Download ZIP (or single PNG) from Blob and extract as base64 data URLs
 * 
 * MAINTAINS: Sequential page mapping (pageNumber: 1, 2, 3, ...)
 * - ZIP files: Extracts PNGs in numerical order
 * - Single PNG: Returns as page 1
 */
export async function downloadAndExtractZip(
  zipUrl: string
): Promise<{ pageNumber: number; base64: string }[]> {
  const JSZip = (await import("jszip")).default;

  console.log("[ZIP Download] Fetching from Blob:", zipUrl);
  const res = await fetch(zipUrl);
  if (!res.ok) throw new Error(`Failed to download from Blob: ${res.status}`);

  const arrayBuffer = await res.arrayBuffer();
  const downloadedBuffer = Buffer.from(arrayBuffer);

  // Check format
  const magicBytes = downloadedBuffer.subarray(0, 4);
  const isZip =
    magicBytes[0] === 0x50 &&
    magicBytes[1] === 0x4B &&
    (magicBytes[2] === 0x03 || magicBytes[2] === 0x05) &&
    (magicBytes[3] === 0x04 || magicBytes[3] === 0x06);

  const isPng = 
    magicBytes[0] === 0x89 &&
    magicBytes[1] === 0x50 &&
    magicBytes[2] === 0x4E &&
    magicBytes[3] === 0x47;

  // Handle single PNG (edge case: 1-page PDF)
  if (isPng) {
    console.log("[ZIP Download] Single PNG detected (1-page document)");
    return [{
      pageNumber: 1,
      base64: `data:image/png;base64,${downloadedBuffer.toString("base64")}`,
    }];
  }

  if (!isZip) {
    throw new Error("Downloaded file is neither ZIP nor PNG");
  }

  // Handle ZIP (standard multi-page case)
  console.log("[ZIP Download] ZIP detected - extracting PNGs");
  const zip = await JSZip.loadAsync(arrayBuffer);

  const pngFiles = Object.keys(zip.files)
    .filter((name) => name.match(/\.png$/i))
    .sort((a, b) => {
      // Extract numeric part from filename (handles "1.png", "page-1.png", etc.)
      const aNum = parseInt(a.match(/(\d+)\.png$/i)?.[1] || "0");
      const bNum = parseInt(b.match(/(\d+)\.png$/i)?.[1] || "0");
      return aNum - bNum;
    });

  if (pngFiles.length === 0) {
    throw new Error("No PNG files found in ZIP");
  }

  console.log(`[ZIP Download] Found ${pngFiles.length} PNGs in ZIP:`, pngFiles.slice(0, 5));

  const pages = await Promise.all(
    pngFiles.map(async (name, index) => {
      const file = zip.file(name)!;
      const buffer = await file.async("nodebuffer");

      return {
        pageNumber: index + 1, // Sequential: 1, 2, 3, ...
        base64: `data:image/png;base64,${buffer.toString("base64")}`,
      };
    })
  );

  console.log(`[ZIP Download] ✓ Extracted ${pages.length} sequential pages from ${zipUrl}`);
  console.log(`[ZIP Download] Page mapping: [${pages.map(p => p.pageNumber).join(", ")}]`);
  
  return pages;
}