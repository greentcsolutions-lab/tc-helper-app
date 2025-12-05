// src/lib/pdfRest/renderer.ts
// FINAL — TypeScript 100% clean, December 2025

import { bufferToBlob } from "@/lib/utils";

if (!process.env.PDFREST_API_KEY?.trim()) {
  throw new Error("PDFREST_API_KEY missing");
}

const PNG_ENDPOINT = "https://api.pdfrest.com/png";

export interface PdfPageImage {
  pageNumber: number;
  base64: string; // data:image/png;base64,...
}

export interface RenderOptions {
  maxPages?: number;
}

export async function renderPdfToPngBase64Array(
  buffer: Buffer,
  options: RenderOptions = {}
): Promise<PdfPageImage[]> {
  const { maxPages } = options;

  const magic = buffer.subarray(0, 8).toString("latin1");
  if (!magic.includes("%PDF")) throw new Error("Invalid PDF");

  console.log("[pdfRest] Rendering PDF → PNG", {
    size: buffer.length,
    pages: maxPages ? `first ${maxPages} (preview)` : "ALL (classifier)",
  });

  const form = new FormData();
  form.append("file", bufferToBlob(buffer, "application/pdf"), "doc.pdf");
  form.append("output", "png");
  form.append("resolution", "300");
  if (maxPages) {
    form.append("pages", `1-${maxPages}`);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), maxPages ? 20_000 : 90_000);

  try {
    const res = await fetch(PNG_ENDPOINT, {
      method: "POST",
      headers: { "Api-Key": process.env.PDFREST_API_KEY! },
      body: form,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`pdfRest PNG failed: ${res.status} ${text}`);
    }

    const json = await res.json();

    // Type-safe handling of pdfRest's chaotic outputUrl(s) formats
    let urls: string[] = [];

    if (Array.isArray(json.outputUrl)) {
      urls = json.outputUrl;
    } else if (typeof json.outputUrl === "string") {
      urls = json.outputUrl
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);
    } else if (Array.isArray(json.outputUrls)) {
      urls = json.outputUrls;
    } else if (typeof json.outputUrls === "string") {
      urls = json.outputUrls
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);
    }

    if (urls.length === 0) throw new Error("No PNG URLs returned");

    const results: PdfPageImage[] = [];

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i].trim();
      const pageNum = i + 1;

      if (maxPages && pageNum > maxPages) break;

      const imgRes = await fetch(url);
      if (!imgRes.ok) throw new Error(`Failed to download page ${pageNum}`);

      const buf = Buffer.from(await imgRes.arrayBuffer());
      results.push({
        pageNumber: pageNum,
        base64: `data:image/png;base64,${buf.toString("base64")}`,
      });
    }

    console.log(`[pdfRest] Success: ${results.length} PNGs rendered`);
    return results;
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error("[pdfRest] PNG render failed:", error.message);
    throw error;
  }
}