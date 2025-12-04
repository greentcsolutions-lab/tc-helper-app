// src/lib/extractor/renderer.ts
import { createCanvas } from "canvas";

export interface PageImage {
  pageNumber: number;
  base64: string;
}

let pdfjsLib: any = null;
let workerUrl: string | null = null;

async function ensurePdfJs() {
  if (pdfjsLib) return pdfjsLib;

  const pdfjs = await import("pdfjs-dist/build/pdf.mjs");

  // ←←← THIS IS THE FIX ←←←
  const workerResponse = await fetch(
    new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url)
  );
  const workerBlob = new Blob([await workerResponse.text()], {
    type: "application/javascript",
  });
  workerUrl = URL.createObjectURL(workerBlob);
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  pdfjsLib = pdfjs;
  return pdfjs;
}

export async function renderPdfToPngBase64Array(buffer: Buffer): Promise<PageImage[]> {
  const pdfjs = await ensurePdfJs();

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    verbosity: 0,
    disableFontFace: false,
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise;
  const pages: PageImage[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 });

    const canvas = createCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext("2d") as any as CanvasRenderingContext2D;

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

  // ←←← Clean up the worker blob URL
  if (workerUrl) {
    URL.revokeObjectURL(workerUrl);
    workerUrl = null;
  }

  return pages;
}