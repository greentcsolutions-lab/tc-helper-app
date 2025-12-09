// src/lib/extractor/classifier.ts
// FINAL FIXED VERSION — handles Vercel cold-start deserialization bug (2025)

import { CLASSIFIER_PROMPT } from "./prompts";

// for debugging API keys
console.log("[classifier] XAI_API_KEY present:", !!process.env.XAI_API_KEY);
console.log("[classifier] First 10 chars:", process.env.XAI_API_KEY?.slice(0, 10));
console.log("[classifier] Nutrient API loaded:", !!process.env.NUTRIENT_API_KEY);

const chunk = <T>(arr: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  );

export async function classifyCriticalPages(
  pages: { pageNumber: number; base64: string }[]
): Promise<{
  criticalImages: { pageNumber: number; base64: string }[];
  state: string;
  criticalPageNumbers: number[];
}> {
  // CRITICAL GUARD — fixes "Cannot read properties of undefined (reading '0')"
  if (!pages || !Array.isArray(pages) || pages.length === 0) {
    console.error("[classifier] FATAL: pages is empty, undefined, or not an array!", {
      pages,
      type: typeof pages,
      length: pages?.length,
    });
    throw new Error("classifyCriticalPages received invalid pages array");
  }

  console.log(`[classifier] Received ${pages.length} pages — starting batch classification`);

  const batches = chunk(pages, 15);
  const pageMap = new Map<string, number>(); // type → highest page number (latest wins)
  let state = "Unknown";

  for (const [i, batch] of batches.entries()) {
    const start = batch[0].pageNumber;
    const end = batch.at(-1)!.pageNumber;

    console.log(`[classifier] Processing batch ${i + 1}/${batches.length} (pages ${start}–${end})`);

    const fullPrompt = CLASSIFIER_PROMPT
      .replace("{{BATCH}}", String(i + 1))
      .replace("{{TOTAL}}", String(batches.length))
      .replace("{{START}}", String(start))
      .replace("{{END}}", String(end));

    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.XAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "grok-4-1-fast-reasoning",
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
      console.error("[classifier] Grok API error:", res.status, text);
      continue; // skip bad batch, don’t crash entire job
    }

    const text = (await res.json()).choices[0].message.content;
    let json;
    try {
      json = JSON.parse(text.match(/{[\s\S]*}/)?.[0] || "{}");
    } catch (err) {
      console.error("[classifier] Failed to parse JSON from Grok:", text);
      continue;
    }

    if (json.state) {
      state = json.state;
      console.log(`[classifier] Detected state: ${state}`);
    }

    for (const item of json.critical_pages || []) {
      if (!pageMap.has(item.type) || pageMap.get(item.type)! < item.page) {
        pageMap.set(item.type, item.page);
      }
    }
  }

  const criticalPageNumbers = Array.from(pageMap.values()).sort((a, b) => a - b);
  const criticalImages = pages.filter(p =>
    criticalPageNumbers.includes(p.pageNumber)
  );

  console.log(`[classifier] Classification complete → ${criticalImages.length} critical pages [${criticalPageNumbers.join(", ")}] | State: ${state}`);

  return {
    state,
    criticalPageNumbers,
    criticalImages,
  };
}