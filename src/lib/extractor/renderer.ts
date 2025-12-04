// src/lib/extractor/renderer.ts
import { createCanvas, ImageData } from "canvas";  // JS-only, Vercel-safe

export interface PageImage {
  pageNumber: number;
  base64: string;
}

// ──────────────────────────────────────────────────────────────
// Path2D + ImageData polyfills (MUST run first — canvas exports these)
// ──────────────────────────────────────────────────────────────
const { applyPath2DToCanvasRenderingContext, Path2D } = require("path2d");
const { CanvasRenderingContext2D } = require("canvas");

applyPath2DToCanvasRenderingContext(CanvasRenderingContext2D);

if (typeof globalThis !== "undefined" && typeof (globalThis as any).Path2D === "undefined") {
  (globalThis as any).Path2D = Path2D;
}

if (typeof globalThis.ImageData === "undefined") {
  (globalThis as any).ImageData = ImageData;
}

// ──────────────────────────────────────────────────────────────
// Canvas factory + pdfjs setup
// ──────────────────────────────────────────────────────────────
let pdfjsLib: any = null;
let workerBlobUrl: string | null = null;

class NodeCanvasFactory {
  create(width: number, height: number) {
    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d");
    return { canvas, context };
  }

  reset(canvasAndContext: { canvas: any; context: any }, width: number, height: number) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }

  destroy() {
    // No cleanup needed for JS canvas
  }
}

async function ensurePdfJs() {
  if (pdfjsLib) return pdfjsLib;

  pdfjsLib = await import("pdfjs-dist/build/pdf.mjs");

  const workerSrc = await import("pdfjs-dist/build/pdf.worker.mjs");
  const blob = new Blob([workerSrc.default], { type: "application/javascript" });
  workerBlobUrl = URL.createObjectURL(blob);

  pdfjsLib.GlobalWorkerOptions.workerSrc = workerBlobUrl;
  return pdfjsLib;
}

export async function renderPdfToPngBase64Array(buffer: Buffer): Promise<PageImage[]> {
  const pdfjs = await ensurePdfJs();
  const canvasFactory = new NodeCanvasFactory();

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    isWorkerDisabled: true,
    useSystemFonts: true,
    cMapUrl: "pdfjs-dist/cmaps/",
    cMapPacked: true,
    standardFontDataUrl: "pdfjs-dist/standard_fonts/",
  });

  const pdf = await loadingTask.promise;
  const pages: PageImage[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 });

    const { canvas, context } = canvasFactory.create(viewport.width, viewport.height);

    const renderContext = {
      canvasContext: context as any as CanvasRenderingContext2D,
      viewport,
      canvasFactory,
    };

    await page.render(renderContext).promise;

    const base64 = canvas.toBuffer("image/png").toString("base64");
    pages.push({
      pageNumber: i,
      base64: `data:image/png;base64,${base64}`,
    });

    page.cleanup();
  }

  pdf.cleanup();
  if (workerBlobUrl) {
    URL.revokeObjectURL(workerBlobUrl);
    workerBlobUrl = null;
  }

  return pages;
}