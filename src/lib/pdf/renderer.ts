// src/lib/pdf/renderer.ts
// Version: 4.0.6 - 2025-12-23
// FIXED: Vercel Blob put() destructuring (current SDK returns object directly)
// FIXED: Explicit flatten action → reliable ZIP output on fillable/signed California packets

import { bufferToBlob } from "@/lib/utils";
import { put } from "@vercel/blob";
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

/**
 * PHASE 1: Parallel dual-DPI render (with flatten)
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
  console.log("[Nutrient:Parallel] 🚀 DUAL-DPI PARALLEL RENDER + FLATTEN");
  console.log("━".repeat(80));
  console.log(`[Nutrient:Parallel] PDF size: ${(buffer.length / 1024).toFixed(2)} KB`);
  console.log(`[Nutrient:Parallel] Total pages: ${totalPages ?? "auto-detect"}`);
  console.log(`[Nutrient:Parallel] Strategy: Flatten → 180 DPI (classify) + 300 DPI (extract) in parallel`);
  console.log("━".repeat(80) + "\n");

  // Validate PDF
  if (!buffer.subarray(0, 8).toString().includes("%PDF")) {
    throw new Error("Invalid PDF");
  }

  // Execute both renders in parallel
  const [lowResResult, highResResult] = await Promise.all([
    renderSingleDpi(buffer, 180, totalPages ?? undefined, "classify"),
    renderSingleDpi(buffer, 300, totalPages ?? undefined, "extract"),
  ]);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  if (lowResResult.pageCount !== highResResult.pageCount) {
    console.warn(`[Nutrient:Parallel] ⚠️ Page count mismatch: 150 DPI returned ${lowResResult.pageCount}, 300 DPI returned ${highResResult.pageCount}`);
  }

  const pageCount = Math.max(lowResResult.pageCount, highResResult.pageCount);

  console.log("\n" + "━".repeat(80));
  console.log("[Nutrient:Parallel] ✅ PARALLEL RENDER + FLATTEN COMPLETE");
  console.log("━".repeat(80));
  console.log(`[Nutrient:Parallel] Total time: ${elapsed}s (parallel execution)`);
  console.log(`[Nutrient:Parallel] Pages rendered: ${pageCount}`);
  console.log(`[Nutrient:Parallel] Low-res (150 DPI): ${lowResResult.pathname}`);
  console.log(`[Nutrient:Parallel] High-res (300 DPI): ${highResResult.pathname}`);
  console.log("━".repeat(80) + "\n");

  return {
    lowRes: lowResResult,
    highRes: highResResult,
    pageCount,
  };
}

async function renderSingleDpi(
  buffer: Buffer,
  dpi: 150 | 300,
  _totalPages: number | undefined,
  purpose: "classify" | "extract"
): Promise<RenderResult> {
  console.log(`[Nutrient:${dpi}dpi:${purpose}] Starting flatten + render...`);

  const blob = bufferToBlob(buffer, "application/pdf");

  const form = new FormData();
  form.append("document", blob, "packet.pdf");

  const instructions = {
    parts: [{ file: "document" }],
    actions: [{ type: "flatten" }], // Burns annotations/fields/signatures → static content
    output: {
      type: "image",
      format: "png",
      dpi: dpi,
      pages: { start: 0 },
      multiPage: true,
    },
  };

  form.append("instructions", JSON.stringify(instructions));

  const res = await fetch(NUTRIENT_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.NUTRIENT_API_KEY}`,
    },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Nutrient failed (${res.status}): ${text}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const zipBlob = new Blob([arrayBuffer], { type: "application/zip" });

  // Upload to Vercel Blob
  const pathname = `renders/${purpose}-${dpi}dpi-${Date.now()}.zip`;
  const uploaded = await put(pathname, zipBlob, {
    access: "public",
    addRandomSuffix: false,
  });

  // Determine page count from ZIP contents
  const zip = await JSZip.loadAsync(arrayBuffer);
  const pngFiles = Object.keys(zip.files).filter((name) => name.match(/\.png$/i));
  const pageCount = pngFiles.length;

  console.log(`[Nutrient:${dpi}dpi:${purpose}] ✓ Render complete: ${pageCount} pages → ${uploaded.pathname}`);

  return {
    url: uploaded.url,
    downloadUrl: uploaded.downloadUrl || uploaded.url,
    pathname: uploaded.pathname,
    pageCount,
  };
}

// -----------------------------------------------------------------------------
// PHASE 2: Download and extract pages from ZIP (unchanged)
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
// HELPER: Extract specific pages from high-res ZIP (unchanged)
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