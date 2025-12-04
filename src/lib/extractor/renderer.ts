// src/lib/extractor/renderer.ts
import { createCanvas } from "@napi-rs/canvas";

export interface PageImage {
  pageNumber: number;
  base64: string;
}

// ESM-only, Turbopack/Vercel optimized (aliased raw worker → blob)
let pdfjsLib: any = null;
let workerBlobUrl: string | null = null;

async function ensurePdfJs() {
  if (pdfjsLib) return pdfjsLib;

  // Dynamic import main lib (externals handle it)
  pdfjsLib = await import("pdfjs-dist/build/pdf.mjs");

  // Alias resolves to raw string → create blob URL (no runtime fetch/404)
  const workerSrcMod = await import("pdfjs-dist/build/pdf.worker.mjs");  // Now a string!
  const workerBlob = new Blob([workerSrcMod.default], { type: "application/javascript" });
  workerBlobUrl = URL.createObjectURL(workerBlob);

  // Set for fake/inline worker
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerBlobUrl;

  return pdfjsLib;
}

export async function renderPdfToPngBase64Array(buffer: Buffer): Promise<PageImage[]> {
  const pdfjs = await ensurePdfJs();

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    verbosity: 0,
    isWorkerDisabled: true,  // Inline mode uses workerSrc blob for logic
    useSystemFonts: true,
    disableFontFace: false,
    cMapUrl: "pdfjs-dist/cmaps/",
    cMapPacked: true,
    standardFontDataUrl: "pdfjs-dist/standard_fonts/",
  });

  const pdf = await loadingTask.promise;
  const pages: PageImage[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 });  // 400 DPI for Grok

    const canvas = createCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext("2d") as any;

    await page.render({ canvasContext: ctx, viewport }).promise;

    const base64 = canvas.toBuffer("image/png").toString("base64");
    pages.push({ pageNumber: i, base64: `data:image/png;base64,${base64}` });
  }

  // Cleanup (Vercel 4GB hygiene)
  if (workerBlobUrl) {
    URL.revokeObjectURL(workerBlobUrl);
    workerBlobUrl = null;
  }

  return pages;
}