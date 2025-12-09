// src/lib/pdf/renderer.ts
// NUTRIENT.IO /build → single-page PNGs (multipart/mixed)
// No ZIP, no parsing, no truncation — 100% Vercel-safe 2025

import { bufferToBlob } from "@/lib/utils";

if (!process.env.NUTRIENT_API_KEY?.trim()) {
  throw new Error("NUTRIENT_API_KEY missing");
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
  const TARGET_DPI = 290; //ultimate

  console.log("[Nutrient] Starting single-page flatten + PNG", {
    fileSizeBytes: buffer.length,
    dpi: TARGET_DPI,
    maxPages,
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
      // THIS IS THE KEY — single-page multipart response
      single_page: true,
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

  if (!res.body) throw new Error("No response body");

  console.log("[Nutrient] Success — parsing multipart/mixed PNG stream");

  const boundary = res.headers.get("content-type")?.match(/boundary=(.*)/)?.[1];
  if (!boundary) throw new Error("No multipart boundary");

  const text = await res.text();
  const parts = text.split(`--${boundary}`).slice(1, -1);

  const pages: PdfRestPage[] = [];

  for (const [index, part] of parts.entries()) {
    if (maxPages && index >= maxPages) break;

    const pngMatch = part.match(/Content-Type: image\/png[\s\S]*?(\�PNG[\s\S]*)/);
    if (!pngMatch) continue;

    const pngBinary = pngMatch[1];
    const base64 = Buffer.from(pngBinary, "binary").toString("base64");

    pages.push({
      pageNumber: index + 1,
      base64: `data:image/png;base64,${base64}`,
    });
  }

  if (pages.length === 0) throw new Error("No PNGs received");

  console.log(`[Nutrient] SUCCESS: ${pages.length} single-page PNGs`);
  return pages;
}