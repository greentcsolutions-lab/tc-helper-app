// src/lib/extractor/pdfrest.ts
// 2025-12-04 — FINAL VERSION: Handles pdfRest's broken comma-separated outputUrl on free tier

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
  console.log("[pdfRest] Starting PDF → PNG conversion");

  const form = new FormData();
  form.append("file", bufferToBlob(buffer, "application/pdf"), "document.pdf");
  form.append("output", "rpa_png");
  form.append("resolution", "290"); // 290 DPI for speed + accuracy

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 55_000);

  try {
    const res = await fetch(PDFREST_ENDPOINT, {
      method: "POST",
      headers: { "Api-Key": process.env.PDFREST_API_KEY! },
      body: form,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`pdfRest failed: ${res.status} ${text}`);
    }

    const json = await res.json();
    console.log("[pdfRest] Raw response:", JSON.stringify(json, null, 2));

    // FIX THE BROKEN FREE-TIER BUG: outputUrl is sometimes a comma-separated string
    let outputUrls: string[] = [];

    if (Array.isArray(json.outputUrl)) {
      outputUrls = json.outputUrl;
    } else if (typeof json.outputUrl === "string") {
      // Split by comma-separated URLs (the bug)
      outputUrls = json.outputUrl.split(",").filter(Boolean);
    } else if (Array.isArray(json.outputUrls)) {
      outputUrls = json.outputUrls;
    } else if (typeof json.outputUrls === "string") {
      outputUrls = json.outputUrls.split(",").filter(Boolean);
    }

    if (outputUrls.length === 0) {
      throw new Error("No valid output URLs found in pdfRest response");
    }

    console.log(`[pdfRest] Fixed & extracted ${outputUrls.length} valid PNG URLs`);

    const pages = await Promise.all(
      outputUrls.map(async (url: string, i: number) => {
        console.log(`[pdfRest] Downloading page ${i + 1}...`);
        const imgRes = await fetch(url.trim()); // ← public URL, no auth needed

        if (!imgRes.ok) {
          const err = await imgRes.text();
          throw new Error(`PNG fetch failed (page ${i + 1}): ${imgRes.status} ${err}`);
        }

        const arrayBuffer = await imgRes.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString("base64");

        return {
          pageNumber: i + 1,
          base64: `data:image/png;base64,${base64}`,
        };
      })
    );

    console.log(`[pdfRest] SUCCESS: ${pages.length} pages converted`);
    return pages;
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error("[pdfRest] FAILED:", error.message);
    throw error;
  }
}