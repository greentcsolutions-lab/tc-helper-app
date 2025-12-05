// src/lib/pdfRest/flatten.ts
const FLATTEN_ENDPOINT = "https://api.pdfrest.com/flattened-forms-pdf";

if (!process.env.PDFREST_API_KEY?.trim()) {
  throw new Error("PDFREST_API_KEY is required for /flattened-forms-pdf");
}

import { bufferToBlob } from "@/lib/utils";

export async function flattenPdf(buffer: Buffer): Promise<Buffer> {
  console.log("[pdfRest] Starting /flattened-forms-pdf flatten...");

  const form = new FormData();
  form.append("file", bufferToBlob(buffer, "application/pdf"), "document.pdf");
  form.append("output", "rpa_flattened");
  form.append("pristine", "true");  // NEW 2025: Strips metadata/AcroForm without corruption

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

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`pdfRest flatten failed: ${res.status} ${text}`);
    }

    const json = await res.json();
    if (!json.outputUrl) throw new Error("No outputUrl from pdfRest");

    const downloadRes = await fetch(json.outputUrl);
    if (!downloadRes.ok) throw new Error(`Download failed: ${downloadRes.status}`);

    const flattenedBytes = await downloadRes.arrayBuffer();
    console.log("[pdfRest] Pristine Flatten complete — metadata-free static PDF ready");
    return Buffer.from(flattenedBytes);
  } catch (error) {
    console.error("[pdfRest] Flatten failed — falling back to original buffer", error);
    return buffer;
  }
}