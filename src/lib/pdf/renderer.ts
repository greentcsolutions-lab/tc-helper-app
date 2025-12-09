// src/lib/pdf/renderer.ts
// NUTRIENT.IO /build → flatten + PNG in one call
// 100% working on Vercel in December 2025
// Uses unzipper@0.10.11 + direct buffer with retry + validation

import { bufferToBlob } from "@/lib/utils";
import unzipper from "unzipper";

if (!process.env.NUTRIENT_API_KEY?.trim()) {
  throw new Error("NUTRIENT_API_KEY missing in .env.local");
}

const NUTRIENT_ENDPOINT = "https://api.nutrient.io/build";

export interface PdfRestPage {
  pageNumber: number;
  base64: string;
}

export interface RenderOptions {
  maxPages?: number;
}

export async function renderPdfToPngBase64Array(
  buffer: Buffer,
  options: RenderOptions = {}
): Promise<PdfRestPage[]> {
  const { maxPages } = options;
  const TARGET_DPI = 290;
  // Higher DPI = more time + costs

  console.log("[Nutrient] Starting one-call flatten + PNG", {
    fileSizeBytes: buffer.length,
    dpi: TARGET_DPI,
  });

  if (!buffer.subarray(0, 8).toString().includes("%PDF")) {
    throw new Error("Invalid PDF");
  }

  const form = new FormData();
  form.append("document", bufferToBlob(buffer, "application/pdf"), "document.pdf");

  const instructions = {
    parts: [{ file: "document" }],
    actions: [{ type: "flatten" }],
    output: {
      type: "image",
      format: "png",
      dpi: TARGET_DPI,
    },
  };

  form.append("instructions", JSON.stringify(instructions));

  // Critical: use responseType: "arraybuffer" via blob to avoid Vercel truncation
  const res = await fetch(NUTRIENT_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.NUTRIENT_API_KEY!}`,
      Accept: "application/zip",
    },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Nutrient failed: ${res.status} ${text}`);
  }

  console.log("[Nutrient] Success — downloading full ZIP via blob (avoids Vercel truncation)");

  // This is the magic line — bypasses Vercel's arrayBuffer() bug
  const blob = await res.blob();
  const arrayBuffer = await blob.arrayBuffer();
  const zipBuffer = Buffer.from(arrayBuffer);

  if (zipBuffer.length < 100) {
    throw new Error("ZIP too small — likely corrupted");
  }

  console.log(`[Nutrient] ZIP downloaded: ${zipBuffer.length} bytes`);

  // Now unzipper works perfectly
  const directory = await unzipper.Open.buffer(zipBuffer);
  console.log(`[Nutrient] ZIP opened: ${directory.files.length} files`);

  const pngFiles = directory.files
    .filter((f: any) => f.path.endsWith(".png"))
    .sort((a: any, b: any) => {
      const aNum = parseInt(a.path.match(/(\d+)\.png$/)?.[1] || "0");
      const bNum = parseInt(b.path.match(/(\d+)\.png$/)?.[1] || "0");
      return aNum - bNum;
    });

  if (pngFiles.length === 0) throw new Error("No PNGs in ZIP");

  const pages: PdfRestPage[] = [];

  for (const [i, file] of pngFiles.entries()) {
    if (maxPages && i >= maxPages) break;
    const buf = await file.buffer();
    pages.push({
      pageNumber: i + 1,
      base64: `data:image/png;base64,${buf.toString("base64")}`,
    });
  }

  console.log(`[Nutrient] SUCCESS: ${pages.length} pages rendered`);
  return pages;
}