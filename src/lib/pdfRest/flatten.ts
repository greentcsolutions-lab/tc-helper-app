// src/lib/pdfRest/flatten.ts
// NOW USING PDFREST /rasterized-pdf — full page rasterization (nuclear bake)
// Replaces flattened-forms-pdf with true rasterized PDF (each page → embedded image)
// This fully bakes forms, annotations, transparencies, fonts → 100% static, no widget choke in PNG render
// Endpoint: https://api.pdfrest.com/rasterized-pdf
// Outputs a PDF with raster images per page → perfect for downstream PNG conversion

const RASTERIZE_ENDPOINT = "https://api.pdfrest.com/rasterized-pdf";

if (!process.env.PDFREST_API_KEY?.trim()) {
  throw new Error("PDFREST_API_KEY is required for /rasterized-pdf");
}

import { bufferToBlob } from "@/lib/utils";

export async function flattenPdf(buffer: Buffer): Promise<Buffer> {
  console.log("[pdfRest] Starting /rasterized-pdf full rasterization...");

  const form = new FormData();
  form.append("file", bufferToBlob(buffer, "application/pdf"), "document.pdf");
  form.append("output", "rpa_rasterized");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45_000); // Slightly longer for rasterize processing

  try {
    const res = await fetch(RASTERIZE_ENDPOINT, {
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
      throw new Error(`pdfRest rasterize failed: ${res.status} ${text}`);
    }

    const json = await res.json();
    if (!json.outputUrl) throw new Error("No outputUrl from pdfRest rasterize");

    console.log("[pdfRest] Rasterize response received — downloading rasterized PDF");

    const downloadRes = await fetch(json.outputUrl);
    if (!downloadRes.ok) throw new Error(`Download failed: ${downloadRes.status}`);

    const rasterizedBytes = await downloadRes.arrayBuffer();
    console.log("[pdfRest] Full rasterization complete — ultra-static rasterized PDF ready (no interactive elements left)");
    return Buffer.from(rasterizedBytes);
  } catch (error) {
    console.error("[pdfRest] Rasterize failed — falling back to original buffer", error);
    // Fallback safe: PNG endpoint can still handle most originals, but now we lose nuclear bake on error
    return buffer;
  }
}