// src/lib/extraction/mistral/assemblePdf.ts
// Version: 1.0.0 - 2026-01-05
// Helper: Takes a chunk of critical images (sorted, ≤8 pages) and builds a multi-page PDF
// Returns pure base64 string (no data: prefix) + mapping for provenance

import { PDFDocument, PageSizes } from 'pdf-lib';

export interface ChunkImage {
  pageNumber: number;
  label: string;
  pageRole: string;
  base64: string; // full data:image/png;base64,... or pure base64
}

export interface AssembledPdf {
  pdfBase64: string; // pure base64, ready for data URI
  pageMapping: Array<{
    chunkPageIndex: number; // 0-based index in this PDF
    originalPageNumber: number;
    label: string;
    pageRole: string;
  }>;
}

/**
 * Assembles a chunk of ≤8 PNG images into a single multi-page PDF
 * Preserves original 200 DPI quality, embeds as full-page images
 */
export async function assemblePdfChunk(images: ChunkImage[]): Promise<AssembledPdf> {
  if (images.length === 0) throw new Error('Empty chunk');
  if (images.length > 8) throw new Error(`Chunk too large: ${images.length} pages (max 8)`);

  const pdfDoc = await PDFDocument.create();

  const pageMapping: AssembledPdf['pageMapping'] = [];

  for (let i = 0; i < images.length; i++) {
    const img = images[i];

    // Strip data URI prefix if present
    const pngBase64 = img.base64.replace(/^data:image\/png;base64,/, '');
    const pngBytes = Uint8Array.from(atob(pngBase64), (c) => c.charCodeAt(0));

    const pngImage = await pdfDoc.embedPng(pngBytes);

    // Use Letter size (standard for real estate forms) – image will be scaled to fit
    const page = pdfDoc.addPage(PageSizes.Letter);
    const { width, height } = page.getSize();

    // Scale image to fit page while preserving aspect ratio
    const scale = Math.min(width / pngImage.width, height / pngImage.height);
    const scaledWidth = pngImage.width * scale;
    const scaledHeight = pngImage.height * scale;

    page.drawImage(pngImage, {
      x: (width - scaledWidth) / 2,
      y: (height - scaledHeight) / 2,
      width: scaledWidth,
      height: scaledHeight,
    });

    pageMapping.push({
      chunkPageIndex: i,
      originalPageNumber: img.pageNumber,
      label: img.label,
      pageRole: img.pageRole,
    });
  }

  const pdfBytes = await pdfDoc.save({ useObjectStreams: false });
  const pdfBase64 = Buffer.from(pdfBytes).toString('base64');

  return { pdfBase64, pageMapping };
}