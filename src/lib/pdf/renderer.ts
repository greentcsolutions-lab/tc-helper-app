// src/lib/pdf/renderer.ts
// Version: 4.0.2 - 2025-12-23
// FIXED: TS errors from previous patch
// - Corrected renderSingleDpi parameter order (optional totalPages first)
// - Awaited the fetch().blob() before passing to put()
// - Updated return types to match current @vercel/blob PutBlobResult (url, downloadUrl, pathname, etc. — no .key)
// - Kept forced ZIP extraction for reliable multi-page handling

import { bufferToBlob } from "@/lib/utils";
import { put, type PutBlobResult } from "@vercel/blob";
import JSZip from "jszip";

if (!process.env.NUTRIENT_API_KEY?.trim()) {
  throw new Error("NUTRIENT_API_KEY missing in .env.local");
}

const NUTRIENT_ENDPOINT = "https://api.nutrient.io/build";

export interface RenderResult {
  url: string;
  downloadUrl: string;
  pathname: string;
  pageCount: number;
}

export interface RenderOptions {
  maxPages?: number;
  pages?: number[];
  dpi?: number;
  totalPages?: number;
}

/**
 * PHASE 1: Parallel dual-DPI render
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
    renderSingleDpi(buffer, 150, totalPages ?? undefined, "classify"),
    renderSingleDpi(buffer, 300, totalPages ?? undefined, "extract"),
  ]);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  if (lowResResult.pageCount !== highResResult.pageCount) {
    console.warn(`[Nutrient:Parallel] ⚠️ Page count mismatch: 150 DPI returned ${lowResResult.pageCount}, 300 DPI returned ${highResResult.pageCount}`);
  }

  const pageCount = Math.max(lowResResult.pageCount, highResResult.pageCount);

  console.log("\n" + "━".repeat(80));
  console.log("[Nutrient:Parallel] ✅ PARALLEL RENDER COMPLETE");
  console.log("━".repeat(80));
  console.log(`[Nutrient:Parallel] Total time: ${elapsed}s (parallel execution)`);
  console.log(`[Nutrient:Parallel] Pages rendered: ${pageCount}`);
  console.log(`[Nutrient:Parallel] Low-res (150 DPI): ${lowResResult.pathname}`);
  console.log(`[Nutrient:Parallel] High-res (300 DPI): ${highResResult.pathname}`);
  console.log("━".repeat(80) + "\n");

  return {
    lowRes: {
      url: lowResResult.url,
      downloadUrl: lowResResult.downloadUrl,
      pathname: lowResResult.pathname,
      pageCount: lowResResult.pageCount,
    },
    highRes: {
      url: highResResult.url,
      downloadUrl: highResResult.downloadUrl,
      pathname: highResResult.pathname,
      pageCount: highResResult.pageCount,
    },
    pageCount,
  };
}

// -----------------------------------------------------------------------------
// Helper: single DPI render — fixed parameter order and put() usage
// -----------------------------------------------------------------------------
async function renderSingleDpi(
  buffer: Buffer,
  dpi: number,
  totalPages: number | undefined,
  purpose: string
): Promise<{ url: string; downloadUrl: string; pathname: string; pageCount: number }> {
  console.log(`[Nutrient:${dpi}dpi:${purpose}] Starting render...`);

  const blob = bufferToBlob(buffer, "application/pdf");

  const response = await fetch(NUTRIENT_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.NUTRIENT_API_KEY}`,
      "Content-Type": "application/pdf",
    },
    body: blob,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Nutrient render failed (${dpi}dpi): ${response.status} ${text}`);
  }

  const data = await response.json();

  // Nutrient returns { url: string; pages: number } — pathname is derived from data.url or provided
  const pathname = data.key ?? new URL(data.url).pathname.split('/').pop();
  const pageCount = data.pages ?? totalPages ?? 1;

  const nutrientBlob = await fetch(data.url).then((r) => r.blob());

  const uploadResult: PutBlobResult = await put(pathname, nutrientBlob, {
    access: "public",
    addRandomSuffix: false,
  });

  console.log(`[Nutrient:${dpi}dpi:${purpose}] ✓ Valid PNG/ZIP received`);
  console.log(`[Nutrient:${dpi}dpi:${purpose}] ✓ Detected ${pageCount} pages`);
  console.log(`[Nutrient:${dpi}dpi:${purpose}] Uploading to Vercel Blob...`);
  console.log(`[Nutrient:${dpi}dpi:${purpose}] ✓ Complete: ${uploadResult.pathname}`);

  return {
    url: uploadResult.url,
    downloadUrl: uploadResult.downloadUrl,
    pathname: uploadResult.pathname,
    pageCount,
  };
}

// -----------------------------------------------------------------------------
// FIXED: Always treat as ZIP for reliable multi-page extraction
// -----------------------------------------------------------------------------
export async function downloadAndExtractZip(
  zipUrl: string
): Promise<{ pageNumber: number; base64: string }[]> {
  console.log(`[ZIP Download] Fetching from Blob: ${zipUrl}`);

  const res = await fetch(zipUrl);
  if (!res.ok) {
    throw new Error(`Failed to download render artifact: ${res.status} ${res.statusText}`);
  }

  const arrayBuffer = await res.arrayBuffer();

  console.log("[ZIP Download] Treating response as ZIP (multi-page forced path)");

  let zip;
  try {
    zip = await JSZip.loadAsync(arrayBuffer);
  } catch (e) {
    console.error("[ZIP Download] Unzip failed — response was not a valid ZIP", e);
    throw new Error("Render artifact is not a valid ZIP — possible Nutrient regression");
  }

  const pngFiles = Object.keys(zip.files)
    .filter((name) => name.match(/\.png$/i))
    .sort((a, b) => {
      const aNum = parseInt(a.match(/(\d+)\.png$/i)?.[1] || "0");
      const bNum = parseInt(b.match(/(\d+)\.png$/i)?.[1] || "0");
      return aNum - bNum;
    });

  if (pngFiles.length === 0) {
    throw new Error("No PNG files found in Nutrient ZIP");
  }

  if (pngFiles.length === 1) {
    console.log("[ZIP Download] Single page detected inside ZIP (normal for 1-page docs)");
  } else {
    console.log(`[ZIP Download] Multi-page ZIP detected — found ${pngFiles.length} PNGs`);
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

  console.log(`[ZIP Download] ✓ Extracted ${pages.length} individual pages`);
  return pages;
}

// -----------------------------------------------------------------------------
// PHASE 1 HELPER: Extract specific pages from high-res ZIP
// -----------------------------------------------------------------------------
export async function extractSpecificPagesFromZip(
  zipUrl: string,
  pageNumbers: number[]
): Promise<{ pageNumber: number; base64: string }[]> {
  console.log(`[Selective Extract] Fetching specific pages from high-res ZIP: [${pageNumbers.join(", ")}]`);

  const allPages = await downloadAndExtractZip(zipUrl);

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