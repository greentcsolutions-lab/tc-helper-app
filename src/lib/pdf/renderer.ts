// src/lib/pdf/renderer.ts
// NUTRIENT.IO /build → flatten + PNG in one call
// Works 100% on Vercel (tested Dec 2025)
// unzipper@0.10.11 + safe arrayBuffer → Open.buffer (no truncation, no stream hacks)

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
  // DPI anywhere from 280-350 is acceptable. 
  // Higher DPI = more time + costs

  console.log("[Nutrient] Starting one-call flatten + PDF → PNG", {
    maxPages: maxPages || "all",
    fileSizeBytes: buffer.length,
    dpi: TARGET_DPI,
  });

  if (!buffer.subarray(0, 8).toString().includes("%PDF")) {
    throw new Error("Invalid PDF: no %PDF header");
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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
    const res = await fetch(NUTRIENT_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.NUTRIENT_API_KEY!}` },
      body: form,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Nutrient /build failed: ${res.status} ${text}`);
    }

    console.log("[Nutrient] Success — reading full ZIP into memory (safe method)");

    // This is the only method that works 100% on Vercel in 2025
    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength === 0) throw new Error("Empty ZIP response");

    const zipBuffer = Buffer.from(arrayBuffer);
    const directory = await unzipper.Open.buffer(zipBuffer);

    console.log(`[Nutrient] ZIP opened: ${directory.files.length} entries`);

    const pngFiles = directory.files
      .filter((f: any) => f.path.match(/\.png$/i))
      .sort((a: any, b: any) => {
        const aNum = parseInt(a.path.match(/(\d+)\.png$/i)?.[1] || "0", 10);
        const bNum = parseInt(b.path.match(/(\d+)\.png$/i)?.[1] || "0", 10);
        return aNum - bNum;
      });

    if (pngFiles.length === 0) throw new Error("No PNGs found in ZIP");

    const pages: PdfRestPage[] = [];

    for (const [index, file] of pngFiles.entries()) {
      if (maxPages !== undefined && index >= maxPages) break;

      console.log(`[Nutrient] Buffering page ${index + 1}: ${file.path}`);
      const pageBuffer = await file.buffer();
      const base64 = pageBuffer.toString("base64");

      pages.push({
        pageNumber: index + 1,
        base64: `data:image/png;base64,${base64}`,
      });
    }

    console.log(`[Nutrient] SUCCESS: ${pages.length} flattened PNGs at ${TARGET_DPI} DPI`);
    return pages;
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error("[Nutrient] FAILED:", error.message || error);
    throw error;
  }
}