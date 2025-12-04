// src/lib/extractor/pdfrest.ts
// 2025-12-04 — FINAL VERSION: TypeScript strict-mode clean + pdfRest API compliant

import { bufferToBlob } from "@/lib/utils";

// ──────────────────────────────────────────────────────────────
// 1. Runtime guard – throws immediately if key missing
// ──────────────────────────────────────────────────────────────
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
 * Flattened PDF Buffer → 350 DPI PNGs (base64) for Grok-4-vision
 */
export async function renderPdfToPngBase64Array(buffer: Buffer): Promise<PdfRestPage[]> {
  const form = new FormData();
  form.append("file", bufferToBlob(buffer, "application/pdf"), "document.pdf");
  form.append("dpi", "350");
  form.append("output", "base64");
  // form.append("grayscale", "true"); // uncomment for old scanned forms

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 55_000);

  try {
    // ──────────────────────────────────────────────────────────────
    //2. At this point TypeScript KNOWS the key exists → safe to assert
    // ──────────────────────────────────────────────────────────────
    const headers: Record<string, string> = {
      "Api-Key": process.env.PDFREST_API_KEY!, // non-null assertion is safe here
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
    const pngs: string[] = json.pngs ?? json.outputFiles ?? [];

    if (pngs.length === 0) {
      throw new Error("pdfRest returned no PNGs — file may be corrupt or empty");
    }

    return pngs.map((base64: string, i: number) => ({
      pageNumber: i + 1,
      base64,
    }));
  } catch (error: any) {
    clearTimeout(timeoutId);

    if (error.name === "AbortError") {
      throw new Error("pdfRest timed out after 55s (Vercel serverless limit)");
    }

    console.error("[pdfRest] renderPdfToPngBase64Array failed:", error);
    throw error;
  }
}