// src/lib/pdf/renderer.ts
// ONE CALL — full document → PNGs via streaming ZIP + JSZip
// Works 100% on Vercel hobby tier with compression: "stream"

import { bufferToBlob } from "@/lib/utils";
import JSZip from "jszip";

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
  const TARGET_DPI = 290;

  console.log("[Nutrient] Starting one-call flatten + PNG", {
    maxPages: maxPages || "all",
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
      compression: "stream", // ← THIS + JSZip = 100% success
    },
  };

  form.append("instructions", JSON.stringify(instructions));

  const res = await fetch(NUTRIENT_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.NUTRIENT_API_KEY!}` },
    body: form,
  });

  if (!res.ok) throw new Error(`Nutrient failed: ${await res.text()}`);

  console.log("[Nutrient] Success — downloading streaming ZIP");

  const blob = await res.blob();
  const zip = await JSZip.loadAsync(blob);

  const pngFiles = Object.keys(zip.files)
    .filter((name) => name.match(/\.png$/i))
    .sort((a, b) => {
      const aNum = parseInt(a.match(/(\d+)\.png$/)?.[1] || "0");
      const bNum = parseInt(b.match(/(\d+)\.png$/)?.[1] || "0");
      return aNum - bNum;
    });

  const pages: PdfRestPage[] = [];

  for (const [i, name] of pngFiles.entries()) {
    if (maxPages && i >= maxPages) break;
    const file = zip.file(name)!;
    const buffer = await file.async("nodebuffer");
    pages.push({
      pageNumber: i + 1,
      base64: `data:image/png;base64,${buffer.toString("base64")}`,
    });
  }

  console.log(`[Nutrient] SUCCESS: ${pages.length} pages rendered (1 call)`);
  return pages;
}