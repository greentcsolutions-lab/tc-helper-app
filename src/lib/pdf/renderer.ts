// src/lib/pdf/renderer.ts
// NUTRIENT.IO /build → one-call flatten + PNG (streaming ZIP, unzipper@0.10.11)
// compression: "stream" + Open.response(res) = 100% hobby-safe, no truncation/FILE_ENDED

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

  console.log("[Nutrient] Starting one-call flatten + PNG (streaming ZIP)", {
    maxPages: maxPages || "all",
    fileSizeBytes: buffer.length,
    dpi: TARGET_DPI,
  });

  // Validate PDF
  const magic = buffer.subarray(0, 8).toString();
  if (!magic.includes("%PDF")) {
    throw new Error("Invalid PDF: missing %PDF header");
  }
  console.log("[Nutrient] PDF header validated");

  const form = new FormData();
  form.append("document", bufferToBlob(buffer, "application/pdf"), "document.pdf");

  const instructions = {
    parts: [{ file: "document" }],
    actions: [
      { type: "flatten" } // Nuclear bake: removes all form fields, annotations, interactivity
    ],
    output: {
      type: "image",
      format: "png",
      dpi: TARGET_DPI, // Optimal for Grok vision: crisp text, good file size, fast processing
      compression: "stream", // Confirmed in guides: enables chunked transfer, prevents Vercel truncation
    },
  };

  form.append("instructions", JSON.stringify(instructions));

  if (maxPages !== undefined) {
    console.log(`[Nutrient] Note: Will render all pages then limit to first ${maxPages} locally`);
  }

  console.log("[Nutrient] Sending request to /build endpoint...");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000); // 60s timeout for large packets

  try {
    const res = await fetch(NUTRIENT_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.NUTRIENT_API_KEY!}`,
      },
      body: form,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Nutrient /build failed: ${res.status} ${text}`);
    }

    console.log("[Nutrient] /build success — streaming ZIP with Open.response");

    // Confirmed API: Open.response(res) parses directly from Response (no full buffer, low memory)
    const directory = await unzipper.Open.response(res);
    console.log(`[Nutrient] ZIP parsed — found ${directory.files.length} entries`);

    const pngFiles = directory.files
      .filter((f: any) => f.path.match(/\.png$/i))
      .sort((a: any, b: any) => {
        const aNum = parseInt(a.path.match(/(\d+)\.png$/i)?.[1] || "0", 10);
        const bNum = parseInt(b.path.match(/(\d+)\.png$/i)?.[1] || "0", 10);
        return aNum - bNum;
      });

    const pages: PdfRestPage[] = [];

    for (const [index, file] of pngFiles.entries()) {
      if (maxPages !== undefined && index >= maxPages) {
        console.log(`[Nutrient] maxPages reached — stopping at page ${index + 1}`);
        break;
      }

      console.log(`[Nutrient] Extracting page ${index + 1} from ${file.path}`);

      const pageBuffer = await file.buffer();
      const base64 = pageBuffer.toString("base64");

      pages.push({
        pageNumber: index + 1,
        base64: `data:image/png;base64,${base64}`,
      });
    }

    console.log(`[Nutrient] SUCCESS: Delivered ${pages.length} flattened + rendered PNG pages (1 call)`);
    return pages;
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error("[Nutrient] FAILED:", error.message || error);
    throw error;
  }
}