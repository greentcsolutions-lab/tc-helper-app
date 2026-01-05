// src/lib/extraction/mistral/assemblePdf.ts
// Version: 2.0.1 - 2026-01-05
// Uploads assembled PDF to Vercel Blob, returns public URL + mapping

import { PDFDocument, PageSizes } from 'pdf-lib';
import { put, PutBlobResult } from '@vercel/blob'; // ← Correct import

export interface ChunkImage {
  pageNumber: number;
  label: string;
  pageRole: string;
  base64: string; // full data:image/png;base64,... or pure base64
}

export interface AssembledPdfBlob {
  url: string;
  blob: PutBlobResult;
  pageMapping: Array<{
    chunkPageIndex: number;
    originalPageNumber: number;
    label: string;
    pageRole: string;
  }>;
}

export async function assemblePdfChunk(
  images: ChunkImage[],
  options: {
    pathname?: string;
    addRandomSuffix?: boolean;
  } = {}
): Promise<AssembledPdfBlob> {
  if (images.length === 0) throw new Error('Empty chunk');
  if (images.length > 8) throw new Error(`Chunk too large: ${images.length} pages (max 8)`);

  const pdfDoc = await PDFDocument.create();

  const pageMapping: AssembledPdfBlob['pageMapping'] = [];

  for (let i = 0; i < images.length; i++) {
    const img = images[i];

    const pngBase64 = img.base64.replace(/^data:image\/png;base64,/, '');
    const pngBytes = Uint8Array.from(atob(pngBase64), (c) => c.charCodeAt(0));

    const pngImage = await pdfDoc.embedPng(pngBytes);

    const page = pdfDoc.addPage(PageSizes.Letter);
    const { width, height } = page.getSize();

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

  // Save PDF as Uint8Array → convert to Buffer for type safety
  const pdfBytes = await pdfDoc.save({ useObjectStreams: false });
  const pdfBuffer = Buffer.from(pdfBytes); // ← This fixes the TS error

  // Generate pathname
  const defaultPath = `temp-extract/chunk-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`;
  const pathname = options.pathname || defaultPath;

  // Upload
  const result = await put(pathname, pdfBuffer, {
    access: 'public',
    addRandomSuffix: options.addRandomSuffix ?? true,
  });

  return {
    url: result.url,
    blob: result,
    pageMapping,
  };
}