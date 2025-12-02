// src/lib/extractor/renderer.ts
import { createCanvas } from "canvas";

// ──────────────────────────────────────
// Lazy-load pdfjs + worker (Vercel 2025)
// ──────────────────────────────────────
let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;

async function ensureWorker() {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then(async (pdfjs) => {
      const worker = await import("pdfjs-dist/build/pdf.worker.mjs");
      const blob = new Blob([worker.default as string], {
        type: "application/javascript",
      });
      pdfjs.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

export interface PageImage {
  pageNumber: number;
  base64: string;
}

export async function renderPdfToPngBase64Array(buffer: Buffer): Promise<PageImage[]> {
  const pdfjs = await ensureWorker();

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    verbosity: 0,
  });

  const pdf = await loadingTask.promise;
  const pages: PageImage[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 });

    const canvas = createCanvas(viewport.width, viewport.height);
    // ←←← FIX: cast to any (node-canvas ctx ≠ DOM ctx)
    const ctx = canvas.getContext("2d") as any;

    await page.render({
      canvasContext: ctx,
      viewport,
    }).promise;

    const base64 = canvas.toBuffer("image/png").toString("base64");
    pages.push({
      pageNumber: i,
      base64: `data:image/png;base64,${base64}`,
    });
  }

  return pages;
}