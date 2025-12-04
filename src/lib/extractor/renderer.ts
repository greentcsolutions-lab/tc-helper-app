// src/lib/extractor/renderer.ts
import { createCanvas } from "canvas";

export interface PageImage {
  pageNumber: number;
  base64: string;
}

// ESM-only, Vercel/Next 15 optimized (inline worker = no instantiation, no ports)
let pdfjsLib: any = null;  // TS-safe: pdfjs exports are dynamic in ESM

async function ensurePdfJs() {
  if (pdfjsLib) return pdfjsLib;

  // Dynamic runtime import (Webpack resolves after externalize in next.config.js)
  pdfjsLib = await import("pdfjs-dist/build/pdf.mjs");

  // ESM setup: Set workerSrc to a dummy path (ignored with isWorkerDisabled: true)
  // This silences "No workerSrc specified" warnings without needing a real file/blob
  (pdfjsLib.GlobalWorkerOptions as any).workerSrc = "pdfjs-dist/build/pdf.worker.mjs";

  return pdfjsLib;
}

export async function renderPdfToPngBase64Array(buffer: Buffer): Promise<PageImage[]> {
  const pdfjs = await ensurePdfJs();

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    verbosity: 0,  // Silence console noise in Vercel logs
    // ← KEY FIX: Inline synchronous mode (no worker thread, ESM/Node-safe)
    isWorkerDisabled: true,  // Runs everything in main thread — zero setup, works on 4GB RAM
    useSystemFonts: true,    // Use Node/system fonts (fixes font loading in canvas)
    disableFontFace: false,  // Allow @font-face if needed (rare in PDFs)
    // Cmaps/fonts: Externalize + next.config.js JSON rule handles resolution
    cMapUrl: "pdfjs-dist/cmaps/",
    cMapPacked: true,
    standardFontDataUrl: "pdfjs-dist/standard_fonts/",
  });

  const pdf = await loadingTask.promise;
  const pages: PageImage[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 });  // ~400 DPI for sharp Grok OCR

    const canvas = createCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext("2d") as any;  // TS cast: node-canvas vs DOM compat

    // Render (inline mode handles text/fonts without mismatches)
    await page.render({
      canvasContext: ctx,
      viewport,
    }).promise;

    // PNG buffer → base64 (Grok vision data URI)
    const base64 = canvas.toBuffer("image/png").toString("base64");
    pages.push({
      pageNumber: i,
      base64: `data:image/png;base64,${base64}`,
    });
  }

  // No cleanup needed (inline = no URLs/ports)

  return pages;
}