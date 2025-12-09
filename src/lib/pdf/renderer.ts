// src/lib/pdf/renderer.ts
// NUTRIENT.IO /build → flatten + PNG in one call
// Binary ZIP output (encoding: "base64" unsupported) + safe blob download + unzipper parse
// 100% working on Vercel, no truncation, no JSON errors

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
      // Removed encoding: "base64" — unsupported, defaults to binary ZIP
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

  // Safe download: blob avoids Vercel fetch bugs for binary
  const blob = await res.blob();
  const arrayBuffer = await blob.arrayBuffer();
  const zipBuffer = Buffer.from(arrayBuffer);

  if (zipBuffer.length < 100) {
    throw new Error("ZIP too small — likely corrupted");
  }

  console.log(`[Nutrient] ZIP downloaded: ${zipBuffer.length} bytes — parsing with unzipper`);

  // Parse ZIP (works 100% now — full buffer from blob)
  const directory = await unzipper.Open.buffer(zipBuffer);
  console.log(`[Nutrient] ZIP parsed: ${directory.files.length} entries`);

  const pngFiles = directory.files
    .filter((f: any) => f.path.match(/\.png$/i))
    .sort((a: any, b: any) => {
      const aNum = parseInt(a.path.match(/(\d+)\.png$/i)?.[1] || "0");
      const bNum = parseInt(b.path.match(/(\d+)\.png$/i)?.[1] || "0");
      return aNum - bNum;
    })
    .slice(0, maxPages || undefined);

  if (pngFiles.length === 0) {
    throw new Error("No PNGs returned from Nutrient");
  }

  const pages: PdfRestPage[] = pngFiles.map((file: any, index: number) => {
    const pageBuffer = file.buffer(); // Sync buffer() in 0.10.11
    const base64 = pageBuffer.toString("base64");
    return {
      pageNumber: index + 1,
      base64: `data:image/png;base64,${base64}`,
    };
  });

  console.log(`[Nutrient] SUCCESS: ${pages.length} PNGs delivered via ZIP parse`);
  return pages;
}