// src/lib/extractor/extractor.ts
import { readFileSync } from "fs";
import path from "path";

const PROMPT_PATH = path.join(process.cwd(), "src/lib/extractor/templates/extractor.txt");
let cachedPrompt: string | null = null;

export function getExtractorPrompt(): string {
  if (!cachedPrompt) {
    cachedPrompt = readFileSync(PROMPT_PATH, "utf-8");
  }
  return cachedPrompt;
}

export async function extractFromCriticalPages(images: { pageNumber: number; base64: string }[]) {
  const prompt = getExtractorPrompt();

  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.XAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "grok-4-1-fast-reasoning",
      temperature: 0,
      max_tokens: 4096,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: prompt },
          ...images.map(img => ({
            type: "image_url",
            image_url: { url: img.base64 }
          }))
        ]
      }]
    }),
  });

  const text = (await res.json()).choices[0].message.content;

  try {
    const json = JSON.parse(text.match(/{[\s\S]*}/)?.[0] || "{}");
    return {
      extracted: json.extracted || {},
      confidence: json.confidence || { overall_confidence: 0 },
      handwriting_detected: !!json.handwriting_detected,
      raw: json,
    };
  } catch (e) {
    return {
      extracted: {},
      confidence: { overall_confidence: 0 },
      handwriting_detected: true,
      raw: { error: text },
    };
  }
}