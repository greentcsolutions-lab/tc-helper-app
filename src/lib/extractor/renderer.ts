// src/lib/extractor/renderer.ts
import { createCanvas } from "canvas";

export interface PageImage {
  pageNumber: number;
  base64: string;
}

// ESM-only pdfjs + worker lazy-load (Vercel 2025 cold-start optimized)
let pdfjsPromise: Promise<typeof import("pdfjs-dist/build/pdf.mjs")> | null = null;

async function ensurePdfJs() {
  if (!pdfjsPromise) {
    // Dynamic import ESM core
    const pdfjs = await import("pdfjs-dist/build/pdf.mjs");
    
    // Dynamic import worker.mjs and blob-ify it (no filesystem, ESM-compatible)
    const workerSrc = await import("pdfjs-dist/build/pdf.worker.mjs");
    const workerBlob = new Blob([workerSrc.default.toString()], {
      type: "application/javascript",
    });
    const workerUrl = URL.createObjectURL(workerBlob);
    
    // Set worker src globally (pdf.js ESM respects this)
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    
    pdfjsPromise = Promise.resolve(pdfjs);
  }
  return pdfjsPromise;
}

export async function renderPdfToPngBase64Array(buffer: Buffer): Promise<PageImage[]> {
  const pdfjs = await ensurePdfJs();

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    verbosity: 0,
    // ESM/Node tweaks: disable font loading issues, use system fonts if avail
    disableFontFace: false,
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise;
  const pages: PageImage[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 }); // ~350-400 DPI for sharp OCR/extraction

    const canvas = createCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext("2d");
    
    // FIX: Silence node-canvas vs DOM mismatch (pdfjs only uses core methods like fillText/transform)
    const renderCtx = ctx as any as CanvasRenderingContext2D;

    // FIX: TS thinks 'canvas' required in RenderParameters, but ESM runtime doesn't need it (v3.11+)
    await page.render({
      canvasContext: renderCtx,
      viewport,
    }).promise;

    // PNG buffer → base64 (keep data URI for Grok vision compat)
    const base64 = canvas.toBuffer("image/png").toString("base64");
    pages.push({
      pageNumber: i,
      base64: `data:image/png;base64,${base64}`,
    });
  }

  // Cleanup blob URLs (memory hygiene for long-running functions on 4GB RAM)
  URL.revokeObjectURL(pdfjs.GlobalWorkerOptions.workerSrc as string);

  return pages;
}