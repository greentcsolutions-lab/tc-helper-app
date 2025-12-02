// src/lib/extractor/classifier.ts
import { readFileSync } from "fs";
import path from "path";

// This file is only imported from server-only contexts (never Edge)
const PROMPT_PATH = path.join(process.cwd(), "src/lib/extractor/templates/classifier.txt");
let cachedPrompt: string | null = null;

export function getClassifierPrompt(): string {
  if (!cachedPrompt) {
    cachedPrompt = readFileSync(PROMPT_PATH, "utf-8");
  }
  return cachedPrompt;
}

const chunk = <T>(arr: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  );

export async function classifyCriticalPages(pages: { pageNumber: number; base64: string }[]) {
  const batches = chunk(pages, 15);
  const pageMap = new Map<string, number>();
  let state = "Unknown";

  const prompt = getClassifierPrompt();

  for (const [i, batch] of batches.entries()) {
    const start = batch[0].pageNumber;
    const end = batch.at(-1)!.pageNumber;

    const fullPrompt = prompt
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

    const text = (await res.json()).choices[0].message.content;
    let json;
    try {
      json = JSON.parse(text.match(/{[\s\S]*}/)?.[0] || "{}");
    } catch {
      console.error("Classifier JSON parse failed:", text);
      continue;
    }

    if (json.state) state = json.state;
    for (const item of json.critical_pages || []) {
      if (!pageMap.has(item.type) || pageMap.get(item.type)! < item.page) {
        pageMap.set(item.type, item.page);
      }
    }
  }

  const criticalImages = pages.filter(p =>
    Array.from(pageMap.values()).includes(p.pageNumber)
  );

  return {
    state,
    criticalPageNumbers: Array.from(pageMap.values()).sort((a, b) => a - b),
    criticalImages,
  };
}