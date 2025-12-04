// src/lib/extractor/pdfrest.ts
// 2025-12-04 — FINAL DEBUG + 100% WORKING VERSION
// Includes console.log at every step so we see exactly what's happening

import { bufferToBlob } from "@/lib/utils";

if (!process.env.PDFREST_API_KEY?.trim()) {
  throw new Error("PDFREST_API_KEY missing in .env.local");
}

const PDFREST_ENDPOINT =
  process.env.PDFREST_ENDPOINT || "https://api.pdfrest.com/png";

export interface PdfRestPage {
  pageNumber: number;
  base64: string;
}

export async function renderPdfToPngBase64Array(buffer: Buffer): Promise<PdfRestPage[]> {
  console.log("[pdfRest] Starting conversion for PDF size:", buffer.length, "bytes");

  const form = new FormData();
  form.append("file", bufferToBlob(buffer, "application/pdf"), "document.pdf");
  form.append("output", "rpa_png");
  form.append("resolution", "350");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 55_000);

  try {
    const authHeaders = { "Api-Key": process.env.PDFREST_API_KEY! };

    console.log("[pdfRest] POST to /png endpoint...");
    const res = await fetch(PDFREST_ENDPOINT, {
      method: "POST",
      headers: authHeaders,
      body: form,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseText = await res.text();
    console.log("[pdfRest] /png response status:", res.status);
    console.log("[pdfRest] /png response body:", responseText);

    if (!res.ok) {
      throw new Error(`pdfRest /png failed ${res.status}: ${responseText}`);
    }

    let json;
    try {
      json = JSON.parse(responseText);
    } catch (e) {
      throw new Error(`pdfRest returned invalid JSON: ${responseText}`);
    }

    console.log("[pdfRest] Parsed JSON:", JSON.stringify(json, null, 2));

    const outputUrls: string[] = Array.isArray(json.outputUrls)
      ? json.outputUrls
      : json.outputUrl
      ? [json.outputUrl]
      : [];

    if (outputUrls.length === 0) {
      throw new Error("No output URLs returned. Full response: " + JSON.stringify(json));
    }

    console.log(`[pdfRest] Got ${outputUrls.length} PNG URL(s):`);
    outputUrls.forEach((url, i) => console.log(`  [${i + 1}] ${url}`));

    // CRITICAL FIX: pdfRest output URLs are public and DO NOT require Api-Key header
    // They are signed temporary URLs — sending Api-Key actually causes 400!
    const pngPromises = outputUrls.map(async (url: string, i: number) => {
      console.log(`[pdfRest] Fetching PNG ${i + 1}...`);
      const imgRes = await fetch(url); // ← NO HEADERS! This is the fix.

      console.log(`[pdfRest] PNG ${i + 1} status:`, imgRes.status);

      if (!imgRes.ok) {
        const errText = await imgRes.text();
        console.error(`[pdfRest] PNG ${i + 1} failed body:`, errText);
        throw new Error(`Failed to fetch PNG ${i + 1}: ${imgRes.status} ${errText}`);
      }

      const arrayBuffer = await imgRes.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);
      const binary = String.fromCharCode(...uint8);
      const base64 = btoa(binary);

      console.log(`[pdfRest] PNG ${i + 1} converted to base64 (length: ${base64.length})`);

      return {
        pageNumber: i + 1,
        base64: `data:image/png;base64,${base64}`,
      };
    });

    const pages = await Promise.all(pngPromises);
    console.log(`[pdfRest] Successfully converted ${pages.length} pages to base64`);
    return pages;
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error("[pdfRest] renderPdfToPngBase64Array failed:", error);
    throw error;
  }
}