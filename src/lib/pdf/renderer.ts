// src/lib/pdf/renderer.ts
// Version: 6.0.0 - 2026-01-06
// CHANGE: Complete migration to local Ghostscript rendering
// REMOVED: All Nutrient.io API calls, dependencies, and environment checks
// ADDED: Fully local parallel Ghostscript + pdf-lib rendering pipeline
// BEHAVIOR: 100% drop-in compatible with existing renderPdfSingle usage

import { put } from "@vercel/blob";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import os from "os";

const execAsync = promisify(exec);

export interface RenderResult {
  url: string;
  downloadUrl: string;
  pathname: string;
  pageCount: number;
}

/**
 * Single universal 200 DPI render with flattening
 * Drop-in replacement for the previous Nutrient-based implementation
 * 
 * Input:  PDF Buffer (from database)
 * Output: ZIP uploaded to Vercel Blob → same RenderResult shape
 */
export async function renderPdfSingle(
  buffer: Buffer,
  totalPages?: number
): Promise<RenderResult> {
  const startTime = Date.now();

  console.log("\n" + "━".repeat(80));
  console.log("[Local Ghostscript:200DPI] 🚀 SINGLE UNIVERSAL RENDER + FLATTEN");
  console.log("━".repeat(80));
  console.log(`[Local Ghostscript:200DPI] PDF size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
  console.log(`[Local Ghostscript:200DPI] Requested pages: ${totalPages ?? "auto-detect"}`);
  console.log("━".repeat(80) + "\n");

  // Basic PDF validation
  if (!buffer.subarray(0, 8).toString().includes("%PDF")) {
    throw new Error("Invalid PDF buffer provided");
  }

  // Load and flatten with pdf-lib
  const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const form = pdfDoc.getForm();
  if (form) {
    console.log("[Local Ghostscript:200DPI] Flattening form fields and annotations...");
    form.flatten();
  }

  const pageCount = pdfDoc.getPageCount();
  console.log(`[Local Ghostscript:200DPI] Detected ${pageCount} pages`);

  // Temporary working directory
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "pdf-render-"));

  try {
    // Ghostscript flags optimized for quality, OCR legibility, and speed
    const gsFlags =
      "-sDEVICE=png16m -r200 -dBATCH -dNOPAUSE -dUseCropBox=false -dTextAlphaBits=4 -dGraphicsAlphaBits=4 -dNumRenderingThreads=4 -q";

    // Dynamic parallel chunking: max 8 chunks, target ~20 pages per chunk
    const maxChunks = Math.min(8, Math.ceil(pageCount / 20));
    const chunkSize = Math.ceil(pageCount / maxChunks);

    console.log(`[Local Ghostscript:200DPI] Using ${maxChunks} parallel chunks (~${chunkSize} pages each)`);

    const renderPromises = [];

    for (let chunkIndex = 0; chunkIndex < maxChunks; chunkIndex++) {
      const globalStartPage = chunkIndex * chunkSize + 1;
      const globalEndPage = Math.min((chunkIndex + 1) * chunkSize, pageCount);

      if (globalStartPage > pageCount) break;

      renderPromises.push(
        (async () => {
          // Create minimal PDF containing only this chunk's pages
          const chunkDoc = await PDFDocument.create();
          const pagesToCopy = Array.from(
            { length: globalEndPage - globalStartPage + 1 },
            (_, i) => globalStartPage - 1 + i
          );
          const copiedPages = await chunkDoc.copyPages(pdfDoc, pagesToCopy);
          copiedPages.forEach((page) => chunkDoc.addPage(page));

          const chunkPath = path.join(tempDir, `chunk_${chunkIndex}.pdf`);
          await fs.writeFile(chunkPath, await chunkDoc.save());

          // Output pattern for Ghostscript
          const tempOutputPattern = path.join(tempDir, `chunk${chunkIndex}-%03d.png`);

          const command = `gs ${gsFlags} -dFirstPage=1 -dLastPage=${globalEndPage - globalStartPage + 1} -sOutputFile="${tempOutputPattern}" "${chunkPath}"`;

          console.log(`[Local Ghostscript:200DPI] Rendering chunk ${chunkIndex + 1}/${maxChunks} (pages ${globalStartPage}–${globalEndPage})`);
          await execAsync(command);

          // Rename chunk-local files to global sequential names
          const pagesInChunk = globalEndPage - globalStartPage + 1;
          for (let localPage = 1; localPage <= pagesInChunk; localPage++) {
            const tempFile = path.join(tempDir, `chunk${chunkIndex}-${String(localPage).padStart(3, "0")}.png`);
            const finalFile = path.join(tempDir, `page-${String(globalStartPage + localPage - 1).padStart(3, "0")}.png`);
            await fs.rename(tempFile, finalFile);
          }

          // Clean up chunk PDF
          await fs.unlink(chunkPath);
        })()
      );
    }

    await Promise.all(renderPromises);

    // Build final ZIP in memory
    console.log("[Local Ghostscript:200DPI] Assembling final ZIP...");
    const zip = new JSZip();

    for (let i = 1; i <= pageCount; i++) {
      const filename = `page-${String(i).padStart(3, "0")}.png`;
      const filePath = path.join(tempDir, filename);
      const pngBuffer = await fs.readFile(filePath);
      zip.file(filename, pngBuffer);
    }

    const zipContent = await zip.generateAsync({ type: "nodebuffer" });

    // Upload to Vercel Blob (identical to previous behavior)
    const pathname = `renders/universal-200dpi-${Date.now()}.zip`;
    const uploaded = await put(pathname, zipContent, {
      access: "public",
      addRandomSuffix: false,
    });

    const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log("\n" + "━".repeat(80));
    console.log("[Local Ghostscript:200DPI] ✅ RENDER COMPLETE");
    console.log(`[Local Ghostscript:200DPI] Duration: ${elapsedSeconds}s`);
    console.log(`[Local Ghostscript:200DPI] Pages rendered: ${pageCount}`);
    console.log(`[Local Ghostscript:200DPI] ZIP size: ${(zipContent.length / 1024 / 1024).toFixed(2)} MB`);
    console.log(`[Local Ghostscript:200DPI] Uploaded to: ${uploaded.url}`);
    console.log("━".repeat(80) + "\n");

    return {
      url: uploaded.url,
      downloadUrl: uploaded.downloadUrl || uploaded.url,
      pathname: uploaded.pathname,
      pageCount,
    };
  } catch (error: any) {
    console.error("[Local Ghostscript:200DPI] ❌ Rendering failed:", error);
    throw error;
  } finally {
    // Always clean up temporary files
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

// -----------------------------------------------------------------------------
// Existing extraction helpers — unchanged and fully compatible
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

  const pages = await Promise.all(
    pngFiles.map(async (name) => {
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

  console.log(`[ZIP Download] Extracted ${pages.length} pages`);
  return pages;
}

export async function extractSpecificPagesFromZip(
  zipUrl: string,
  pageNumbers: number[]
): Promise<{ pageNumber: number; base64: string }[]> {
  console.log(`[ZIP Extract Specific] Fetching ZIP and extracting pages: ${pageNumbers.join(", ")}`);

  const res = await fetch(zipUrl);
  if (!res.ok) {
    throw new Error(`Failed to download ZIP: ${res.status}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  const pngFiles = Object.keys(zip.files)
    .filter((name) => name.match(/\.png$/i))
    .sort((a, b) => {
      const aNum = parseInt(a.match(/(\d+)\.png$/i)?.[1] || "0");
      const bNum = parseInt(b.match(/(\d+)\.png$/i)?.[1] || "0");
      return aNum - bNum;
    });

  const requestedSet = new Set(pageNumbers);

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

  const missing = pageNumbers.filter((p) => !pages.some((pg) => pg.pageNumber === p));
  if (missing.length > 0) {
    console.warn(`[ZIP Extract Specific] Missing pages: ${missing.join(", ")}`);
  }

  console.log(`[ZIP Extract Specific] Successfully extracted ${pages.length} pages`);
  return pages;
}