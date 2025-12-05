// src/lib/pdfRest/renderer.ts
// FINAL 2025 VERSION — supports maxPages for instant first-9-page preview

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

export interface RenderOptions {
  maxPages?: number;
}

export async function renderPdfToPngBase64Array(
  buffer: Buffer,
  options: RenderOptions = {}
): Promise<PdfRestPage[]> {
  const { maxPages } = options;

  console.log("[pdfRest] Starting PDF → PNG conversion", { maxPages: maxPages || "all" });

  const magic = buffer.subarray(0, 8).toString();
    if (!magic.includes("%PDF")) {
      throw new Error("Not a valid PDF");
    }

  const form = new FormData();
  form.append("file", bufferToBlob(buffer, "application/pdf"), "document.pdf");
  form.append("output", "rpa_png");
  form.append("resolution", "290");

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
    console.log("[pdfRest] Raw response received");

    // Handle broken comma-separated outputUrl (free tier bug)
    let outputUrls: string[] = [];

    if (Array.isArray(json.outputUrl)) {
      outputUrls = json.outputUrl;
    } else if (typeof json.outputUrl === "string") {
      outputUrls = json.outputUrl.split(",").map((s: string) => s.trim()).filter(Boolean);
    } else if (Array.isArray(json.outputUrls)) {
      outputUrls = json.outputUrls;
    } else if (typeof json.outputUrls === "string") {
      outputUrls = json.outputUrls.split(",").map((s: string) => s.trim()).filter(Boolean);
    }

    if (outputUrls.length === 0) {
      throw new Error("No output URLs from pdfRest");
    }

    console.log(`[pdfRest] Found ${outputUrls.length} PNG URLs`);

    const downloadPromises = outputUrls.map(async (url: string, i: number) => {
      // STOP EARLY if maxPages is set
      if (maxPages !== undefined && i >= maxPages) {
        return null;
      }

      console.log(`[pdfRest] Downloading page ${i + 1}${maxPages ? ` (max: ${maxPages})` : ""}`);
      const imgRes = await fetch(url.trim());

      if (!imgRes.ok) {
        const err = await imgRes.text();
        throw new Error(`Failed to fetch PNG (page ${i + 1}): ${err}`);
      }

      const arrayBuffer = await imgRes.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");

      return {
        pageNumber: i + 1,
        base64: `data:image/png;base64,${base64}`,
      };
    });

    const pages = await Promise.all(downloadPromises);
    const filteredPages = pages.filter((p): p is PdfRestPage => p !== null);

    console.log(`[pdfRest] SUCCESS: Returned ${filteredPages.length} pages`);
    return filteredPages;
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error("[pdfRest] FAILED:", error.message);
    throw error;
  }
}