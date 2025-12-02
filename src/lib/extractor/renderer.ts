// src/lib/extractor/renderer.ts
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import { createCanvas } from "canvas";  // <-- add "canvas" to dependencies

GlobalWorkerOptions.workerSrc = "pdfjs-dist/build/pdf.worker.mjs";

export async function renderPdfToPngBase64Array(buffer: Buffer) {
  const loadingTask = getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;

  const pages: { pageNumber: number; base64: string }[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const scale = 2.0;
    const viewport = page.getViewport({ scale });

    // Use node-canvas which implements full CanvasRenderingContext2D
    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext("2d");

    await page.render({
      canvasContext: context as any, // pdfjs is not fully typed for node-canvas
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