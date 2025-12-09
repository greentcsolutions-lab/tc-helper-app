// src/lib/pdf/renderer.ts
// NOW USING NUTRIENT.IO /build — single-call flatten + PNG render
// Fixed all TS errors: proper unzipper typing + explicit params in sort

import { bufferToBlob } from "@/lib/utils";
import unzipper from "unzipper";

// ──────────────────────────────────────────────────────────────
// Proper typing for unzipper (no @types package exists)
// This removes the "Could not find declaration" error
// ──────────────────────────────────────────────────────────────
declare module "unzipper" {
  export interface CentralDirectory {
    files: Entry[];
  }
  export interface Entry {
    path: string;
    buffer(): Promise<Buffer>;
  }
  export function OpenResponse(response: Response): Promise<CentralDirectory>;
}
const { OpenResponse } = unzipper as any; // fallback for runtime

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

  const TARGET_DPI = 320;

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
  const timeoutId = setTimeout(() => controller.abort(), 20000);

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

    console.log("[Nutrient] Success — streaming ZIP");
    const directory = await unzipper.Open.response(res);
    console.log(`[Nutrient] ZIP opened: ${directory.files.length} entries`);

    // ──────────────────────────────────────────────────────────────
    // Explicit typing on sort callback → fixes the three "any" errors
    // ──────────────────────────────────────────────────────────────
    const pngFiles = directory.files
      .filter((f: unzipper.Entry) => f.path.match(/\.png$/i))
      .sort((a: unzipper.Entry, b: unzipper.Entry) => {
        const aNum = parseInt(a.path.match(/(\d+)\.png$/i)?.[1] || "0", 10);
        const bNum = parseInt(b.path.match(/(\d+)\.png$/i)?.[1] || "0", 10);
        return aNum - bNum;
      });

    if (pngFiles.length === 0) throw new Error("No PNGs in ZIP");

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
    console.error("[Nutrient] FAILED:", error.message);
    throw error;
  }
}