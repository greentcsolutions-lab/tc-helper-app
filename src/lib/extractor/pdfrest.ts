// src/lib/extractor/pdfrest.ts
// 2025-12-04 — FIXED: Proper Headers auth on output fetches + resolution=350 (docs-compliant)
// Matches https://docs.pdfrest.com/.../png exactly — for 1000+ CA RPAs/day

import { bufferToBlob } from "@/lib/utils";

if (!process.env.PDFREST_API_KEY?.trim()) {
  throw new Error(
    "PDFREST_API_KEY is missing or empty in .env.local — get a free key at https://pdfrest.com/apikey"
  );
}

const PDFREST_ENDPOINT =
  process.env.PDFREST_ENDPOINT || "https://api.pdfrest.com/png"; // eu-api.pdfrest.com for CCPA

export interface PdfRestPage {
  pageNumber: number;
  base64: string; // data:image/png;base64,...
}

/**
 * Flattened PDF Buffer → 350 DPI PNGs (base64) via pdfRest /png endpoint
 * Docs-compliant: resolution param, fetch URLs with Api-Key Headers → convert to base64 for Grok-4-vision
 */
export async function renderPdfToPngBase64Array(buffer: Buffer): Promise<PdfRestPage[]> {
  const form = new FormData();
  form.append("file", bufferToBlob(buffer, "application/pdf"), "document.pdf");
  form.append("output", "rpa_png"); // Prefix only — docs-compliant filename base
  form.append("resolution", "350"); // Docs: 12-2400 DPI, default 300 — 350 for sharp handwriting

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 55_000);

  try {
    const headers: Record<string, string> = {
      "Api-Key": process.env.PDFREST_API_KEY!, // Safe post-validation
    };

    const res = await fetch(PDFREST_ENDPOINT, {
      method: "POST",
      headers,
      body: form,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const text = await res.text();
      console.error("[pdfRest] API Error:", res.status, text);
      throw new Error(`pdfRest failed ${res.status}: ${text.substring(0, 300)}`);
    }

    const json = await res.json();
    // Docs: outputUrl (single) or outputUrls (array) — normalize to array
    const outputUrls: string[] = Array.isArray(json.outputUrls)
      ? json.outputUrls
      : json.outputUrl
      ? [json.outputUrl]
      : [];

    if (outputUrls.length === 0) {
      throw new Error("pdfRest returned no output URLs — invalid PDF?");
    }

    // Fetch each PNG + convert to base64 (parallel for speed)
    // FIXED: Use new Headers() for Node/Vercel fetch compatibility
    const fetchHeaders = new Headers();
    fetchHeaders.set("Api-Key", process.env.PDFREST_API_KEY!);

    const pngPromises = outputUrls.map(async (url: string, i: number) => {
      const imgRes = await fetch(url, { headers: fetchHeaders });
      if (!imgRes.ok) throw new Error(`Failed to fetch PNG ${i + 1}: ${imgRes.status}`);
      const arrayBuffer = await imgRes.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);
      const binary = String.fromCharCode(...uint8);
      const base64 = btoa(binary);
      return {
        pageNumber: i + 1,
        base64: `data:image/png;base64,${base64}`,
      };
    });

    const pages = await Promise.all(pngPromises);
    return pages;
  } catch (error: any) {
    clearTimeout(timeoutId);

    if (error.name === "AbortError") {
      throw new Error("pdfRest timed out after 55s (Vercel limit)");
    }

    console.error("[pdfRest] renderPdfToPngBase64Array failed:", error);
    throw error;
  }
}