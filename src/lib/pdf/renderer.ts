// src/lib/pdf/renderer.ts
// NUTRIENT.IO /build → flatten + PNG in one call
// JSZip for ZIP64/modern ZIP parsing (no FILE_ENDED on Nutrient ZIPs)
// 100% Vercel-safe, pure JS, no deps issues

import { bufferToBlob } from "@/lib/utils";
import JSZip from "jszip";

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

  console.log("[Nutrient] Starting one-call flatten + PNG → ZIP + parse", {
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

  const res = await fetch(NUTRIENT_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.NUTRIENT_API_KEY!}`,
    },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Nutrient failed: ${res.status} ${text}`);
  }

  console.log("[Nutrient] Success — downloading ZIP via blob (safe from truncation)");

  const blob = await res.blob();
  const arrayBuffer = await blob.arrayBuffer();
  const zipBuffer = Buffer.from(arrayBuffer);

  if (zipBuffer.length < 100) {
    throw new Error("ZIP too small — likely corrupted");
  }

  console.log(`[Nutrient] ZIP downloaded: ${zipBuffer.length} bytes — parsing with JSZip`);

  // JSZip handles ZIP64/modern ZIPs perfectly (no FILE_ENDED)
  const zip = await JSZip.loadAsync(zipBuffer);
  console.log(`[Nutrient] ZIP parsed: ${Object.keys(zip.files).length} entries`);

  const pngFiles = Object.keys(zip.files)
    .filter((name) => name.match(/\.png$/i))
    .map((name) => ({ name, file: zip.files[name] }))
    .sort((a, b) => {
      const aNum = parseInt(a.name.match(/(\d+)\.png$/i)?.[1] || "0");
      const bNum = parseInt(b.name.match(/(\d+)\.png$/i)?.[1] || "0");
      return aNum - bNum;
    })
    .slice(0, maxPages || undefined);

  if (pngFiles.length === 0) {
    throw new Error("No PNGs returned from Nutrient");
  }

  const pages: PdfRestPage[] = await Promise.all(
    pngFiles.map(async ({ name, file }, index) => {
      console.log(`[Nutrient] Buffering page ${index + 1}: ${name}`);
      const pageBuffer = await file.async("arraybuffer");
      const base64 = Buffer.from(pageBuffer).toString("base64");
      return {
        pageNumber: index + 1,
        base64: `data:image/png;base64,${base64}`,
      };
    })
  );

  console.log(`[Nutrient] SUCCESS: ${pages.length} PNGs delivered via ZIP parse`);
  return pages;
}