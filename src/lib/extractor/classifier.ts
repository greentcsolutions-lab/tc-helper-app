// src/lib/extractor/classifier.ts
// Version: 2.0.0 - PARALLEL classification with 6-page batches for <20s speed
// Optimized for Vercel Hobby 60s timeout

import { CLASSIFIER_PROMPT } from "./prompts";

console.log("[classifier] XAI_API_KEY present:", !!process.env.XAI_API_KEY);
console.log("[classifier] First 10 chars:", process.env.XAI_API_KEY?.slice(0, 10));
console.log("[classifier] Nutrient API loaded:", !!process.env.NUTRIENT_API_KEY);

const chunk = <T>(arr: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  );

async function classifyBatch(
  batch: { pageNumber: number; base64: string }[],
  batchIndex: number,
  totalBatches: number
): Promise<{ state?: string; criticalPages: { type: string; page: number }[] }> {
  const start = batch[0].pageNumber;
  const end = batch[batch.length - 1].pageNumber;

  const fullPrompt = CLASSIFIER_PROMPT
    .replace("{{BATCH}}", String(batchIndex + 1))
    .replace("{{TOTAL}}", String(totalBatches))
    .replace("{{START}}", String(start))
    .replace("{{END}}", String(end));

  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.XAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "grok-2-vision-1212",
        temperature: 0,
        max_tokens: 512,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: fullPrompt },
            ...batch.map(p => ({ type: "image_url", image_url: { url: p.base64 } }))
          ]
        }]
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[classifier:batch${batchIndex + 1}] Grok error:`, res.status, text);
      return { criticalPages: [] }; // Skip failed batch, don't crash entire job
    }

    const text = (await res.json()).choices[0].message.content;
    let json;
    try {
      json = JSON.parse(text.match(/{[\s\S]*}/)?.[0] || "{}");
    } catch (err) {
      console.error(`[classifier:batch${batchIndex + 1}] JSON parse failed:`, text);
      return { criticalPages: [] };
    }

    console.log(`[classifier:batch${batchIndex + 1}] ✓ Pages ${start}–${end} classified`);

    return {
      state: json.state,
      criticalPages: json.critical_pages || [],
    };
  } catch (error: any) {
    console.error(`[classifier:batch${batchIndex + 1}] Request failed:`, error.message);
    return { criticalPages: [] };
  }
}

export async function classifyCriticalPages(
  pages: { pageNumber: number; base64: string }[]
): Promise<{
  criticalImages: { pageNumber: number; base64: string }[];
  state: string;
  criticalPageNumbers: number[];
}> {
  if (!pages || !Array.isArray(pages) || pages.length === 0) {
    console.error("[classifier] FATAL: pages is empty, undefined, or not an array!", {
      pages,
      type: typeof pages,
      length: pages?.length,
    });
    throw new Error("classifyCriticalPages received invalid pages array");
  }

  const BATCH_SIZE = 6; // 5-7 page sweet spot → 12-15s for 50-page doc
  const batches = chunk(pages, BATCH_SIZE);

  console.log(`[classifier] Starting PARALLEL classification: ${pages.length} pages → ${batches.length} batches of ~${BATCH_SIZE}`);
  const startTime = Date.now();

  // 🚀 PARALLEL PROCESSING - all batches run simultaneously
  const results = await Promise.allSettled(
    batches.map((batch, i) => classifyBatch(batch, i, batches.length))
  );

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[classifier] ✓ All batches complete in ${elapsed}s`);

  // Aggregate results from all successful batches
  const pageMap = new Map<string, number>(); // type → highest page number
  let state = "Unknown";

  for (const result of results) {
    if (result.status === "rejected") {
      console.warn("[classifier] Batch failed:", result.reason);
      continue;
    }

    const data = result.value;
    if (data.state) state = data.state;

    for (const item of data.criticalPages) {
      if (!pageMap.has(item.type) || pageMap.get(item.type)! < item.page) {
        pageMap.set(item.type, item.page);
      }
    }
  }

  const criticalPageNumbers = Array.from(pageMap.values()).sort((a, b) => a - b);
  const criticalImages = pages.filter(p => criticalPageNumbers.includes(p.pageNumber));

  console.log(`[classifier] Final result: ${criticalImages.length} critical pages [${criticalPageNumbers.join(", ")}] | State: ${state}`);

  return {
    state,
    criticalPageNumbers,
    criticalImages,
  };
}
