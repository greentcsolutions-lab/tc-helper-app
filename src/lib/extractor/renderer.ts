// src/lib/extractor/renderer.ts
import { createCanvas, ImageData, SKRSContext2D } from "@napi-rs/canvas";

export interface PageImage {
  pageNumber: number;
  base64: string;
}

// Inject ImageData once (fixes internal new ImageData() calls)
if (typeof globalThis.ImageData === "undefined") {
  (globalThis as any).ImageData = ImageData;
}

let pdfjsLib: any = null;
let workerBlobUrl: string | null = null;

class NodeCanvasFactory {
  create(width: number, height: number) {
    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d") as SKRSContext2D;
    return { canvas, context };
  }

  reset(canvasAndContext: { canvas: any; context: SKRSContext2D }, width: number, height: number) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }

  destroy(_canvasAndContext: any) {
    // @napi-rs/canvas cleans up automatically
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
      canvasContext: context as any as CanvasRenderingContext2D, // ← THIS LINE FIXES TS
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