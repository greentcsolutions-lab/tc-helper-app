// src/lib/pdf/flatten.ts
import { PDFDocument } from "pdf-lib";

export async function flattenPdf(buffer: Buffer): Promise<Buffer> {
  try {
    const pdfDoc = await PDFDocument.load(buffer, {
      ignoreEncryption: true,
      capNumbers: true,
      updateMetadata: false,
    });

    const form = pdfDoc.getForm();
    if (form?.acroForm) {
      try {
        form.flatten();
      } catch (e) {
        console.warn("[flattenPdf] form.flatten() failed on malformed AcroForm – skipping");
      }
    }

    const pdfBytes = await pdfDoc.save({
      useObjectStreams: false, // prevents "invalid object ref" warnings
    });

    return Buffer.from(pdfBytes);
  } catch (error) {
    console.error("[flattenPdf] Unexpected error – returning original buffer", error);
    return buffer;
  }
}