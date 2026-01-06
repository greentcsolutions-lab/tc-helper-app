// src/lib/pdf/renderer.ts
// Version: 5.0.0 - 2025-12-30
// BREAKING CHANGE: Single 200 DPI render for both classification AND extraction
// REMOVED: Dual parallel rendering (180 DPI + 300 DPI)
// ADDED: Universal 200 DPI render + extract specific pages function

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
 * PHASE 1: Single 200 DPI render (with flatten)
 * Used for BOTH classification and extraction
 * 
 * @param buffer - PDF buffer
 * @param totalPages - Optional page count for validation
 * @returns Single RenderResult with 200 DPI ZIP
 */
export async function renderPdfSingle(
  buffer: Buffer,
  totalPages?: number
): Promise<RenderResult> {
  const startTime = Date.now();

  console.log("\n" + "━".repeat(80));
  console.log("[Nutrient:200DPI] 🚀 SINGLE UNIVERSAL RENDER + FLATTEN");
  console.log("━".repeat(80));
  console.log(`[Nutrient:200DPI] PDF size: ${(buffer.length / 1024).toFixed(2)} KB`);
  console.log(`[Nutrient:200DPI] Total pages: ${totalPages ?? "auto-detect"}`);
  console.log(`[Nutrient:200DPI] Strategy: Flatten → 200 DPI (classify + extract)`);
  console.log(`[Nutrient:200DPI] DISCOVERY: 200 DPI is sufficient for AI extraction quality`);
  console.log("━".repeat(80) + "\n");

  // Validate PDF
  if (!buffer.subarray(0, 8).toString().includes("%PDF")) {
    throw new Error("Invalid PDF");
  }

  // Execute single 200 DPI render
  const renderResult = await renderSingleDpi(buffer, 200, totalPages ?? undefined, "universal");

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("\n" + "━".repeat(80));
  console.log("[Nutrient:200DPI] ✅ SINGLE RENDER + FLATTEN COMPLETE");
  console.log("━".repeat(80));
  console.log(`[Nutrient:200DPI] Total time: ${elapsed}s`);
  console.log(`[Nutrient:200DPI] Pages rendered: ${renderResult.pageCount}`);
  console.log(`[Nutrient:200DPI] Universal (200 DPI): ${renderResult.pathname}`);
  console.log("━".repeat(80) + "\n");

  return renderResult;
}

async function renderSingleDpi(
  buffer: Buffer,
  dpi: 200,
  _totalPages: number | undefined,
  purpose: "universal"
): Promise<RenderResult> {
  console.log(`[Nutrient:${dpi}dpi:${purpose}] Starting flatten + render...`);

  const blob = bufferToBlob(buffer, "application/pdf");

  const form = new FormData();
  form.append("document", blob, "packet.pdf");

  const instructions = {
    parts: [{ file: "document" }],
    actions: [{ type: "flatten" }],
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

  const pathname = `renders/${purpose}-${dpi}dpi-${Date.now()}.zip`;
  const uploaded = await put(pathname, zipBlob, {
    access: "public",
    addRandomSuffix: false,
  });

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
// PHASE 2: Download and extract ALL pages from ZIP
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

  // Extract page number from PNG filename
  const pages = await Promise.all(
    pngFiles.map(async (name) => {
      const file = zip.file(name)!;
      const buffer = await file.async("nodebuffer");

      // Extract page number from filename
      const pngIndex = parseInt(name.match(/(\d+)\.png$/i)?.[1] || "0");
      const pageNumber = pngIndex + 1;

      return {
        pageNumber,
        base64: `data:image/png;base64,${buffer.toString("base64")}`,
      };
    })
  );

  // Enhanced logging: Show actual page numbers assigned
  const pageNumbers = pages.map(p => p.pageNumber);
  console.log(`[ZIP Download] ✓ Extracted ${pages.length} individual pages`);
  console.log(`[ZIP Download] 🔍 Page numbers assigned: [${pageNumbers.slice(0, 5).join(', ')}${pageNumbers.length > 5 ? '...' : ''}]`);

  return pages;
}

// -----------------------------------------------------------------------------
// PHASE 3: Extract SPECIFIC pages from ZIP (for extraction route)
// -----------------------------------------------------------------------------
export async function extractSpecificPagesFromZip(
  zipUrl: string,
  pageNumbers: number[]
): Promise<{ pageNumber: number; base64: string }[]> {
  console.log(`[ZIP Extract Specific] Fetching from Blob: ${zipUrl}`);
  console.log(`[ZIP Extract Specific] Requested pages: [${pageNumbers.join(', ')}]`);

  const res = await fetch(zipUrl);
  if (!res.ok) {
    throw new Error(`Failed to download render artifact: ${res.status} ${res.statusText}`);
  }

  const arrayBuffer = await res.arrayBuffer();

  let zip;
  try {
    zip = await JSZip.loadAsync(arrayBuffer);
  } catch (e) {
    console.error("[ZIP Extract Specific] Unzip failed", e);
    throw new Error("Render artifact is not a valid ZIP");
  }

  const pngFiles = Object.keys(zip.files)
    .filter((name) => name.match(/\.png$/i))
    .sort((a, b) => {
      const aNum = parseInt(a.match(/(\d+)\.png$/i)?.[1] || "0");
      const bNum = parseInt(b.match(/(\d+)\.png$/i)?.[1] || "0");
      return aNum - bNum;
    });

  console.log(`[ZIP Extract Specific] Total PNGs in ZIP: ${pngFiles.length}`);

  // Create a set for O(1) lookup
  const requestedSet = new Set(pageNumbers);

  // Extract only requested pages
  const pages = await Promise.all(
    pngFiles
      .filter((name) => {
        const pngIndex = parseInt(name.match(/(\d+)\.png$/i)?.[1] || "0");
        const pageNumber = pngIndex + 1;
        return requestedSet.has(pageNumber);
      })
      .map(async (name) => {
        const file = zip.file(name)!;
        const buffer = await file.async("nodebuffer");

        const pngIndex = parseInt(name.match(/(\d+)\.png$/i)?.[1] || "0");
        const pageNumber = pngIndex + 1;

        return {
          pageNumber,
          base64: `data:image/png;base64,${buffer.toString("base64")}`,
        };
      })
  );

  console.log(`[ZIP Extract Specific] ✓ Extracted ${pages.length}/${pageNumbers.length} requested pages`);
  console.log(`[ZIP Extract Specific] 🔍 Extracted page numbers: [${pages.map(p => p.pageNumber).join(', ')}]`);

  // Verify all requested pages were found
  const extractedPageNumbers = new Set(pages.map(p => p.pageNumber));
  const missingPages = pageNumbers.filter(p => !extractedPageNumbers.has(p));
  
  if (missingPages.length > 0) {
    console.warn(`[ZIP Extract Specific] ⚠️ Missing pages: [${missingPages.join(', ')}]`);
  }

  return pages;
}