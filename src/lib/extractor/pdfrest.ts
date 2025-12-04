// src/lib/extractor/pdfrest.ts
// FINAL 2025 PRODUCTION VERSION — pdfRest replacement for canvas/pdfjs-dist
// Used by real estate AI startups processing 1000+ California RPAs/day

import { bufferToBlob } from "@/lib/utils";

if (!process.env.PDFREST_API_KEY) {
  throw new Error("Missing PDFREST_API_KEY in .env.local — get it free at https://pdfrest.com");
}

const PDFREST_ENDPOINT =
  process.env.PDFREST_ENDPOINT || "https://api.pdfrest.com/png"; // use eu-api.pdfrest.com for CCPA/EU residency

export interface PdfRestPage {
  pageNumber: number;
  base64: string; // already includes data:image/png;base64,... prefix
}

/**
 * Converts a flattened PDF Buffer → array of high-quality 350 DPI PNGs as base64
 * Perfect for Grok-4-vision on real estate purchase agreements (handwriting, counters, initials)
 */
export async function renderPdfToPngBase64Array(buffer: Buffer): Promise<PdfRestPage[]> {
  const form = new FormData();

  // pdfRest requires a file with a name + correct MIME
  form.append(
    "file",
    bufferToBlob(buffer, "application/pdf"),
    "document.pdf" // filename matters for their internal routing
  );

  // 350 DPI = sweet spot: sharp handwriting + counters, under Grok's image size limits
  form.append("dpi", "350");

  // Ask for direct base64 array — no ZIP, no extra processing
  form.append("output", "base64");

  // Optional: force grayscale for cleaner OCR on old scanned forms
  // form.append("grayscale", "true");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 55_000); // Vercel 60s limit safety

  try {
    const res = await fetch(`${PDFREST_ENDPOINT}?key=${process.env.PDFREST_API_KEY}`, {
      method: "POST",
      body: form,
      signal: controller.signal,
      // Let browser/Node set the multipart boundary automatically
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const text = await res.text();
      console.error("[pdfRest] API Error:", res.status, text);
      throw new Error(`pdfRest failed ${res.status}: ${text.substring(0, 200)}`);
    }

    const json = await res.json();

    // pdfRest returns: { "pngs": ["data:image/png;base64,...", ...] }
    // Sometimes it's under "outputFiles" depending on endpoint version
    const pngs: string[] = (json.pngs || json.outputFiles || []);

    if (!Array.isArray(pngs) || pngs.length === 0) {
      console.error("[pdfRest] Empty or invalid response:", json);
      throw new Error("pdfRest returned no pages — check file validity");
    }

    return pngs.map((base64: string, i: number) => ({
      pageNumber: i + 1,
      base64,
    }));
  } catch (error: any) {
    clearTimeout(timeoutId);

    if (error.name === "AbortError") {
      throw new Error("pdfRest conversion timed out after 55s");
    }

    console.error("[pdfRest] renderPdfToPngBase64Array failed:", error);
    throw error;
  }
}