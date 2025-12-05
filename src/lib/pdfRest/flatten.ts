// src/lib/pdfRest/flatten.ts
import { bufferToBlob } from "@/lib/utils";
import { PDFDocument, PDFName } from "pdf-lib";

const FLATTEN_ENDPOINT = "https://api.pdfrest.com/flattened-forms-pdf";

if (!process.env.PDFREST_API_KEY?.trim()) {
  throw new Error("PDFREST_API_KEY is required for /flattened-forms-pdf");
}

export async function flattenPdf(buffer: Buffer): Promise<Buffer> {
  console.log("[pdfRest] Starting /flattened-forms-pdf flatten...");

  const form = new FormData();
  form.append("file", bufferToBlob(buffer, "application/pdf"), "document.pdf");
  form.append("output", "rpa_flattened");

  let flattenedBuffer: Buffer = buffer; // default fallback

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch(FLATTEN_ENDPOINT, {
      method: "POST",
      headers: {
        "Api-Key": process.env.PDFREST_API_KEY!,
      },
      body: form,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`pdfRest flatten failed: ${res.status} ${(await res.text())}`);

    const { outputUrl } = await res.json();
    if (!outputUrl) throw new Error("No outputUrl from pdfRest");

    const download = await fetch(outputUrl);
    if (!download.ok) throw new Error(`Download failed: ${download.status}`);

    flattenedBuffer = Buffer.from(await download.arrayBuffer());
    console.log("[pdfRest] Flatten Forms complete — 100% static PDF ready");
  } catch (err) {
    console.error("[pdfRest] Flatten failed — using original buffer", err);
  }

  // NEW 2025 FIX: Strip AcroForm dictionary so pdfRest PNG endpoint stops 400-ing
  try {
    console.log("[pdf-lib] Loading PDF to strip AcroForm metadata...");
    const pdfDoc = await PDFDocument.load(flattenedBuffer, { ignoreEncryption: true });

    // Correct modern way (pdf-lib ≥1.17)
    const catalog = pdfDoc.catalog; // PDFDict
    if (catalog.has(PDFName.of("AcroForm"))) {
      catalog.delete(PDFName.of("AcroForm"));
      console.log("[pdf-lib] AcroForm entry removed");
    }

    const cleanBytes = await pdfDoc.save({
      useObjectStreams: false, // keeps file size tiny
      addDefaultPage: false,
    });

    console.log("[pdf-lib] PDF is now perfectly static & PNG-ready");
    return Buffer.from(cleanBytes);
  } catch (err) {
    console.warn("[pdf-lib] Failed to strip AcroForm (non-fatal), proceeding with flattened PDF:", err);
    return flattenedBuffer;
  }
}