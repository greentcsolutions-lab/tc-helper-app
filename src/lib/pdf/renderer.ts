// src/lib/pdf/renderer.ts
// NUTRIENT.IO /build → flatten + PNG in one call
// True streaming ZIP extraction (no FILE_ENDED, no pipe() on Web ReadableStream)
// Works on Vercel Node runtime + unzipper@0.10.11

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
  // DPI between 280-350 is enough for Grok vision. 
  // Higher the DPI, slower the process + larger the files. 

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

    if (!res.body) throw new Error("No response body from Nutrient");

    console.log("[Nutrient] Success — streaming ZIP directly");

    // Convert Web ReadableStream → Node.js Readable (Vercel Node runtime supports this)
    const nodeStream = require("stream").web.Readable.toWeb(res.body) as any;
    const zipStream = nodeStream.pipe(unzipper.Parse());

    const pngEntries: any[] = [];

    await new Promise<void>((resolve, reject) => {
      zipStream.on("entry", (entry: any) => {
        if (entry.path.match(/\.png$/i)) {
          pngEntries.push(entry);
        } else {
          // autodrain is valid on unzipper@0.10.11 Entry
          entry.autodrain();
        }
      });

      zipStream.on("error", (err: any) => {
        console.error("[Nutrient] ZIP stream error:", err);
        reject(err);
      });

      zipStream.on("finish", () => {
        console.log(`[Nutrient] ZIP stream finished — found ${pngEntries.length} PNGs`);
        resolve();
      });
    });

    // Sort by filename number
    const sortedPngs = pngEntries.sort((a: any, b: any) => {
      const aNum = parseInt(a.path.match(/(\d+)\.png$/i)?.[1] || "0", 10);
      const bNum = parseInt(b.path.match(/(\d+)\.png$/i)?.[1] || "0", 10);
      return aNum - bNum;
    });

    if (sortedPngs.length === 0) throw new Error("No PNG files found in ZIP");

    const pages: PdfRestPage[] = [];

    for (const [index, entry] of sortedPngs.entries()) {
      if (maxPages !== undefined && index >= maxPages) break;

      console.log(`[Nutrient] Buffering page ${index + 1}: ${entry.path}`);
      const pageBuffer = await entry.buffer();
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