// src/lib/pdf/renderer.ts
// Version: 4.2.1 - 2025-12-30
// OPTIMIZED: Minimal logging under 256 line limit
//reverted

import { bufferToBlob } from "@/lib/utils";
import { put } from "@vercel/blob";
import JSZip from "jszip";

const NUTRIENT_ENDPOINT = "https://api.nutrient.io/build";

export async function renderPdfToPngZip(
  buffer: Buffer,
  purpose: "classify" | "extract",
  dpi: 150 | 300
): Promise<{
  url: string;
  downloadUrl: string;
  pathname: string;
  pageCount: number;
}> {
  console.log(`[render] ${purpose} ${dpi}dpi...`);

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
    headers: { Authorization: `Bearer ${process.env.NUTRIENT_API_KEY}` },
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

  console.log(`[render] Complete: ${pageCount} pages → ${uploaded.pathname}`);

  return {
    url: uploaded.url,
    downloadUrl: uploaded.downloadUrl || uploaded.url,
    pathname: uploaded.pathname,
    pageCount,
  };
}

export async function downloadAndExtractZip(
  zipUrl: string
): Promise<{ pageNumber: number; base64: string }[]> {
  console.log(`[zip] Fetching: ${zipUrl.substring(0, 60)}...`);

  const res = await fetch(zipUrl);
  if (!res.ok) {
    throw new Error(`Failed to download: ${res.status} ${res.statusText}`);
  }

  const arrayBuffer = await res.arrayBuffer();

  let zip;
  try {
    zip = await JSZip.loadAsync(arrayBuffer);
  } catch (e) {
    throw new Error("Not a valid ZIP");
  }

  const pngFiles = Object.keys(zip.files)
    .filter((name) => name.match(/\.png$/i))
    .sort((a, b) => {
      const aNum = parseInt(a.match(/(\d+)\.png$/i)?.[1] || "0");
      const bNum = parseInt(b.match(/(\d+)\.png$/i)?.[1] || "0");
      return aNum - bNum;
    });

  if (pngFiles.length === 0) {
    throw new Error("No PNG files in ZIP");
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

  const pageNumbers = pages.map(p => p.pageNumber);
  console.log(`[zip] Extracted ${pages.length} pages: [${pageNumbers.slice(0, 3).join(',')}...${pageNumbers.slice(-2).join(',')}]`);
  
  return pages;
}

export async function extractSpecificPagesFromZip(
  zipUrl: string,
  pageNumbers: number[]
): Promise<{ pageNumber: number; base64: string }[]> {
  console.log(`[select] Requested: [${pageNumbers.join(',')}]`);

  const allPages = await downloadAndExtractZip(zipUrl);
  console.log(`[select] Available: ${allPages.length} pages [${allPages.map(p => p.pageNumber).slice(0, 3).join(',')}...${allPages.map(p => p.pageNumber).slice(-2).join(',')}]`);

  const selectedPages = allPages.filter((page) => pageNumbers.includes(page.pageNumber));

  // Check for issues
  const selectedNums = new Set(selectedPages.map(p => p.pageNumber));
  const missing = pageNumbers.filter(num => !selectedNums.has(num));
  
  if (missing.length > 0) {
    console.warn(`[select] MISSING: [${missing.join(',')}] - page numbering mismatch!`);
  }

  if (selectedPages.length === 0) {
    console.error(`[select] FATAL: No pages matched! Req=[${pageNumbers.join(',')}] Avail=[${allPages.map(p => p.pageNumber).join(',')}]`);
    throw new Error(`None of requested pages found in ZIP`);
  }

  console.log(`[select] Matched ${selectedPages.length}/${pageNumbers.length}: [${selectedPages.map(p => p.pageNumber).join(',')}]`);
  
  return selectedPages;
}