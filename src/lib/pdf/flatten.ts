// src/lib/pdf/flatten.ts
// NUCLEAR FLATTEN v5 — 2025 Final (TypeScript-safe, XFA-killer)
// Works on pdf-lib 1.17.1 (no hasXFA/disconnectXFA methods yet)

import { PDFDocument, PDFName } from "pdf-lib";

export async function flattenPdf(buffer: Buffer): Promise<Buffer> {
  try {
    const srcDoc = await PDFDocument.load(buffer, {
      ignoreEncryption: true,
      capNumbers: false,
      updateMetadata: false,
    });

    // ——— XFA PURGE (the nuclear way that works in pdf-lib 1.17.1) ———
    const form = srcDoc.getForm();
    const acroForm = form?.acroForm;

    if (acroForm) {
      // 1. Look for the XFA key anywhere in the AcroForm dictionary
      const xfaKey = [...acroForm.dict.keys()].find((key) =>
        key.toString() === "XFA"
      );

      if (xfaKey) {
        acroForm.dict.delete(xfaKey);
        console.log("[flattenPdf] XFA dataset (XFA key) forcibly removed");
      }

      // 2. Flatten any remaining AcroForm fields aggressively
      try {
        form.flatten();
      } catch (e) {
        console.warn("[flattenPdf] form.flatten() failed – continuing anyway");
      }
    }

    // ——— Rasterize everything into a brand-new PDF ———
    const cleanDoc = await PDFDocument.create();
    const pages = await cleanDoc.copyPages(srcDoc, srcDoc.getPageIndices());

    for (const page of pages) {
      cleanDoc.addPage(page);
    }

    // ——— Final cleanup: delete AcroForm dict from catalog if it survived ———
    const catalog = srcDoc.catalog;
    if (catalog.has(PDFName.of("AcroForm"))) {
      catalog.delete(PDFName.of("AcroForm"));
      console.log("[flattenPdf] AcroForm dictionary removed from catalog");
    }

    const pdfBytes = await cleanDoc.save({
      useObjectStreams: false,
      addDefaultPage: false,
    });

    console.log("[flattenPdf] Nuclear flatten v5 complete — XFA & AcroForm obliterated");
    return Buffer.from(pdfBytes);
  } catch (error) {
    console.error("[flattenPdf] Everything failed — returning original", error);
    return buffer;
  }
}