// src/lib/extractor/renderer.ts
import { getDocument, GlobalWorkerOptions, version } from "pdfjs-dist";
import { createCanvas } from "canvas";

// ←←← Correct ESM worker import (no .mjs extension needed when using the main entrypoint)
import workerSrc from "pdfjs-dist/build/pdf.worker.entry";

// One-time global setup – safe to run on every cold start
GlobalWorkerOptions.workerSrc = workerSrc;

export interface PageImage {
  pageNumber: number;
  base64: string; // data:image/png;base64,...
}

export async function renderPdfToPngBase64Array(buffer: Buffer): Promise<PageImage[]> {
  const loadingTask = getDocument({
    data: new Uint8Array(buffer),
    // Silence noisy warnings from malformed real-estate PDFs
    verbosity: 0,
  });

  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  const pages: PageImage[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const scale = 2.0; // ~400 DPI
    const viewport = page.getViewport({ scale });

    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext("2d");

    await page.render({
      canvasContext: context as any,
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