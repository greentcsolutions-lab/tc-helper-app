// src/lib/pdf/renderer.ts
// Version: 4.0.0 - 2025-12-23
// PHASE 1: Parallel dual-DPI rendering (150 DPI + 300 DPI upfront)
// MAINTAINED: All existing functions for backward compatibility

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
  totalPages?: number;
}

/**
 * PHASE 1: Parallel dual-DPI render
 * Renders both classification (150 DPI) and extraction (300 DPI) sets upfront
 * 
 * Returns:
 * - lowRes: Full document @ 150 DPI for classification sweep
 * - highRes: Full document @ 300 DPI stored for selective extraction later
 * 
 * Cost impact: ~2x Nutrient API calls upfront, but:
 * - Eliminates sequential wait time (renders in parallel)
 * - Enables selective high-res extraction (only critical pages)
 * - Net savings: ~60-70% on large packets (e.g., 60-page doc → extract 20 pages)
 */
export async function renderPdfParallel(
  buffer: Buffer,
  totalPages?: number
): Promise<{
  lowRes: RenderResult;
  highRes: RenderResult;
  pageCount: number;
}> {
  const startTime = Date.now();

  console.log("\n" + "━".repeat(80));
  console.log("[Nutrient:Parallel] 🚀 DUAL-DPI PARALLEL RENDER");
  console.log("━".repeat(80));
  console.log(`[Nutrient:Parallel] PDF size: ${(buffer.length / 1024).toFixed(2)} KB`);
  console.log(`[Nutrient:Parallel] Total pages: ${totalPages ?? "auto-detect"}`);
  console.log(`[Nutrient:Parallel] Strategy: 150 DPI (classify) + 300 DPI (extract) in parallel`);
  console.log("━".repeat(80) + "\n");

  // Validate PDF
  if (!buffer.subarray(0, 8).toString().includes("%PDF")) {
    throw new Error("Invalid PDF");
  }

  // Execute both renders in parallel
  const [lowResResult, highResResult] = await Promise.all([
    renderSingleDpi(buffer, 150, totalPages, "classify"),
    renderSingleDpi(buffer, 300, totalPages, "extract"),
  ]);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // Verify page counts match
  if (lowResResult.pageCount !== highResResult.pageCount) {
    console.warn(`[Nutrient:Parallel] ⚠️ Page count mismatch: 150 DPI returned ${lowResResult.pageCount}, 300 DPI returned ${highResResult.pageCount}`);
  }

  const pageCount = Math.max(lowResResult.pageCount, highResResult.pageCount);

  console.log("\n" + "━".repeat(80));
  console.log("[Nutrient:Parallel] ✅ PARALLEL RENDER COMPLETE");
  console.log("━".repeat(80));
  console.log(`[Nutrient:Parallel] Total time: ${elapsed}s (parallel execution)`);
  console.log(`[Nutrient:Parallel] Pages rendered: ${pageCount}`);
  console.log(`[Nutrient:Parallel] Low-res (150 DPI): ${lowResResult.result.key}`);
  console.log(`[Nutrient:Parallel] High-res (300 DPI): ${highResResult.result.key}`);
  console.log("━".repeat(80) + "\n");

  return {
    lowRes: lowResResult.result,
    highRes: highResResult.result,
    pageCount,
  };
}

/**
 * Internal: Single DPI render with error handling
 */
async function renderSingleDpi(
  buffer: Buffer,
  dpi: number,
  totalPages: number | undefined,
  purpose: "classify" | "extract"
): Promise<{ result: RenderResult; pageCount: number }> {
  const key = `renders/${Date.now()}-${crypto.randomUUID()}-${dpi}dpi.zip`;

  console.log(`[Nutrient:${dpi}dpi:${purpose}] Starting render...`);

  const instructions: any = {
    parts: [{ file: "document" }],
    actions: [{ type: "flatten" }],
    output: {
      type: "image",
      format: "png",
      dpi,
    },
  };

  // Configure page range
  if (totalPages && totalPages > 1) {
    instructions.output.pages = {
      start: 0,
      end: totalPages - 1,
    };
    console.log(`[Nutrient:${dpi}dpi:${purpose}] Rendering pages 0-${totalPages - 1}`);
  } else if (totalPages === null) {
    console.log(`[Nutrient:${dpi}dpi:${purpose}] Auto-detect mode`);
  }

  const form = new FormData();
  form.append("document", bufferToBlob(buffer, "application/pdf"), "document.pdf");
  form.append("instructions", JSON.stringify(instructions));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90_000);

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

      if (
        text.toLowerCase().includes("password") ||
        text.toLowerCase().includes("encrypted document")
      ) {
        console.error(`[Nutrient:${dpi}dpi:${purpose}] Password-protected PDF detected`);
        throw new Error("PDF_PASSWORD_PROTECTED");
      }

      console.error(`[Nutrient:${dpi}dpi:${purpose}] API error:`, res.status, text);
      throw new Error(`Nutrient failed: ${res.status} ${text}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    const responseBuffer = Buffer.from(arrayBuffer);

    // Validate response format
    const magicBytes = responseBuffer.subarray(0, 4);
    const isZip =
      magicBytes[0] === 0x50 &&
      magicBytes[1] === 0x4b &&
      (magicBytes[2] === 0x03 || magicBytes[2] === 0x05) &&
      (magicBytes[3] === 0x04 || magicBytes[3] === 0x06);

    const isPng =
      magicBytes[0] === 0x89 &&
      magicBytes[1] === 0x50 &&
      magicBytes[2] === 0x4e &&
      magicBytes[3] === 0x47;

    if (!isZip && !isPng) {
      console.error(`[Nutrient:${dpi}dpi:${purpose}] Invalid response format`);
      throw new Error("Nutrient returned invalid format (expected ZIP or PNG)");
    }

    const formatType = isZip ? "ZIP" : "PNG";
    console.log(`[Nutrient:${dpi}dpi:${purpose}] ✓ Valid ${formatType} received`);

    // Quick page count detection (without full extraction)
    let detectedPageCount = 1;
    if (isZip) {
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(arrayBuffer);
      const pngFiles = Object.keys(zip.files).filter((name) => name.match(/\.png$/i));
      detectedPageCount = pngFiles.length;
    }

    console.log(`[Nutrient:${dpi}dpi:${purpose}] ✓ Detected ${detectedPageCount} pages`);

    // Upload to Blob
    console.log(`[Nutrient:${dpi}dpi:${purpose}] Uploading to Blob...`);
    const { url } = await put(key, responseBuffer, {
      access: "public",
      multipart: true,
      addRandomSuffix: false,
    });

    console.log(`[Nutrient:${dpi}dpi:${purpose}] ✓ Complete: ${key}`);

    return {
      result: { url, key },
      pageCount: detectedPageCount,
    };
  } catch (error: any) {
    clearTimeout(timeoutId);

    if (error.message === "PDF_PASSWORD_PROTECTED") {
      throw new Error(
        "This PDF is password-protected. Please provide an unlocked version or remove the password."
      );
    }

    console.error(`[Nutrient:${dpi}dpi:${purpose}] FAILED:`, error.message);
    throw error;
  }
}

/**
 * LEGACY: Original single-DPI render (kept for backward compatibility)
 * Use renderPdfParallel() for new implementations
 */
export async function renderPdfToPngZipUrl(
  buffer: Buffer,
  options: RenderOptions = {}
): Promise<RenderResult> {
  const { maxPages, pages, dpi = 300, totalPages } = options;
  const key = `renders/${Date.now()}-${crypto.randomUUID()}.zip`;

  console.log("[Nutrient:Legacy] Single-DPI render (consider using renderPdfParallel)");
  console.log("[Nutrient:Legacy] Config:", {
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

  if (pages && pages.length > 0) {
    console.log(`[Nutrient:Legacy] Specific pages mode: extracting ${pages.length} pages`);
    instructions.parts = pages.map((pageNum) => ({
      file: "document",
      pages: {
        start: pageNum - 1,
        end: pageNum - 1,
      },
    }));
  } else {
    let renderPageCount: number | null = null;

    if (maxPages) {
      renderPageCount = maxPages;
    } else if (totalPages) {
      renderPageCount = totalPages;
    }

    if (renderPageCount && renderPageCount > 1) {
      instructions.output.pages = {
        start: 0,
        end: renderPageCount - 1,
      };
      console.log(`[Nutrient:Legacy] Multi-page ZIP: pages 0-${renderPageCount - 1}`);
    } else if (renderPageCount === null) {
      console.log(`[Nutrient:Legacy] Auto-detect mode`);
    }
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

      if (
        text.toLowerCase().includes("password") ||
        text.toLowerCase().includes("encrypted document")
      ) {
        console.error("[Nutrient:Legacy] Password-protected PDF detected");
        throw new Error("PDF_PASSWORD_PROTECTED");
      }

      console.error("[Nutrient:Legacy] API error:", res.status, text);
      throw new Error(`Nutrient failed: ${res.status} ${text}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    const responseBuffer = Buffer.from(arrayBuffer);

    const magicBytes = responseBuffer.subarray(0, 4);
    const isZip =
      magicBytes[0] === 0x50 &&
      magicBytes[1] === 0x4b &&
      (magicBytes[2] === 0x03 || magicBytes[2] === 0x05) &&
      (magicBytes[3] === 0x04 || magicBytes[3] === 0x06);

    const isPng =
      magicBytes[0] === 0x89 &&
      magicBytes[1] === 0x50 &&
      magicBytes[2] === 0x4e &&
      magicBytes[3] === 0x47;

    if (!isZip && !isPng) {
      console.error("[Nutrient:Legacy] Invalid response format");
      throw new Error("Nutrient returned invalid format (expected ZIP or PNG)");
    }

    const formatType = isZip ? "ZIP" : "PNG";
    console.log(`[Nutrient:Legacy] ✓ Valid ${formatType} → uploading to Blob`);

    const { url } = await put(key, responseBuffer, {
      access: "public",
      multipart: true,
      addRandomSuffix: false,
    });

    const modeDesc = pages
      ? `pages [${pages.join(", ")}]`
      : maxPages
      ? `first ${maxPages} pages`
      : totalPages
      ? `all ${totalPages} pages`
      : "all pages (auto-detected)";

    console.log(`[Nutrient:Legacy] Complete: ${modeDesc} @ ${dpi} DPI → ${formatType} → ${key}`);
    return { url, key };
  } catch (error: any) {
    clearTimeout(timeoutId);

    if (error.message === "PDF_PASSWORD_PROTECTED") {
      throw new Error(
        "This PDF is password-protected. Please provide an unlocked version or remove the password."
      );
    }

    console.error("[Nutrient:Legacy] FAILED:", error.message);
    throw error;
  }
}

/**
 * Download and extract images from Blob storage
 * Handles both ZIP (multi-page) and single PNG formats
 * 
 * MAINTAINED: Sequential page mapping (pageNumber: 1, 2, 3, ...)
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

  const magicBytes = downloadedBuffer.subarray(0, 4);
  const isZip =
    magicBytes[0] === 0x50 &&
    magicBytes[1] === 0x4b &&
    (magicBytes[2] === 0x03 || magicBytes[2] === 0x05) &&
    (magicBytes[3] === 0x04 || magicBytes[3] === 0x06);

  const isPng =
    magicBytes[0] === 0x89 &&
    magicBytes[1] === 0x50 &&
    magicBytes[2] === 0x4e &&
    magicBytes[3] === 0x47;

  if (isPng) {
    console.log("[ZIP Download] Single PNG detected (1-page document)");
    return [
      {
        pageNumber: 1,
        base64: `data:image/png;base64,${downloadedBuffer.toString("base64")}`,
      },
    ];
  }

  if (!isZip) {
    throw new Error("Downloaded file is neither ZIP nor PNG");
  }

  console.log("[ZIP Download] ZIP detected - extracting PNGs");
  const zip = await JSZip.loadAsync(arrayBuffer);

  const pngFiles = Object.keys(zip.files)
    .filter((name) => name.match(/\.png$/i))
    .sort((a, b) => {
      const aNum = parseInt(a.match(/(\d+)\.png$/i)?.[1] || "0");
      const bNum = parseInt(b.match(/(\d+)\.png$/i)?.[1] || "0");
      return aNum - bNum;
    });

  if (pngFiles.length === 0) {
    throw new Error("No PNG files found in ZIP");
  }

  console.log(`[ZIP Download] Found ${pngFiles.length} PNGs:`, pngFiles.slice(0, 5));

  const pages = await Promise.all(
    pngFiles.map(async (name, index) => {
      const file = zip.file(name)!;
      const buffer = await file.async("nodebuffer");

      return {
        pageNumber: index + 1,
        base64: `data:image/png;base64,${buffer.toString("base64")}`,
      };
    })
  );

  console.log(`[ZIP Download] ✓ Extracted ${pages.length} sequential pages`);
  return pages;
}

/**
 * PHASE 1 HELPER: Extract specific pages from high-res ZIP
 * Used after classification identifies critical pages (e.g., pages [1, 2, 15, 16, 20])
 * 
 * Returns only the requested pages, maintaining original page numbers
 */
export async function extractSpecificPagesFromZip(
  zipUrl: string,
  pageNumbers: number[]
): Promise<{ pageNumber: number; base64: string }[]> {
  console.log(`[Selective Extract] Fetching specific pages from high-res ZIP: [${pageNumbers.join(", ")}]`);

  // Download all pages first
  const allPages = await downloadAndExtractZip(zipUrl);

  // Filter to only requested pages
  const selectedPages = allPages.filter((page) => pageNumbers.includes(page.pageNumber));

  if (selectedPages.length === 0) {
    throw new Error(`None of the requested pages [${pageNumbers.join(", ")}] found in ZIP`);
  }

  if (selectedPages.length < pageNumbers.length) {
    const missing = pageNumbers.filter(
      (num) => !selectedPages.some((p) => p.pageNumber === num)
    );
    console.warn(`[Selective Extract] ⚠️ Missing pages: [${missing.join(", ")}]`);
  }

  console.log(`[Selective Extract] ✓ Extracted ${selectedPages.length}/${pageNumbers.length} requested pages`);
  return selectedPages;
}