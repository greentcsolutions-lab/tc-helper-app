// src/lib/pdf/flatten.ts
import { PDFDocument } from "pdf-lib";

export async function flattenPdf(buffer: Buffer): Promise<Buffer> {
  try {
    const pdfDoc = await PDFDocument.load(buffer, {
      ignoreEncryption: true,
      capNumbers: true,
    });
    const form = pdfDoc.getForm();
    form?.flatten();
    return Buffer.from(await pdfDoc.save({ useObjectStreams: false }));
  } catch (error) {
    console.error("[flattenPdf] Failed, returning original:", error);
    return buffer;
  }
}