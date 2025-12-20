// src/lib/extractor/extractor.ts
// Version: 2.1.0 - 2025-12-20
// UPDATED: Accepts labeled images and injects clear section headers for Grok

import { EXTRACTOR_PROMPT, SECOND_TURN_PROMPT } from "./prompts";

interface LabeledImage {
  pageNumber: number;
  base64: string;
  label: string;
}

export async function extractFromCriticalPages(
  images: LabeledImage[],
  previousResult?: any  // optional for second-turn boost
) {
  let prompt = EXTRACTOR_PROMPT;

  if (previousResult) {
    prompt = SECOND_TURN_PROMPT.replace(
      "{{PREVIOUS_JSON}}",
      JSON.stringify(previousResult, null, 2)
    );
  }

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
          ...images.flatMap(img => [
            {
              type: "text",
              text: `\n━━━ ${img.label} ━━━`
            },
            {
              type: "image_url",
              image_url: { url: img.base64 }
            }
          ])
        ]
      }]
    }),
  });

  const text = (await res.json()).choices[0].message.content;

  try {
    const json = JSON.parse(text.match(/{[\s\S]*}/)?.[0] || "{}");
    
    // CRITICAL: Check for handwriting rejection
    if (json.handwriting_detected && json.rejection_reason) {
      console.error('[extractor] ✗ DOCUMENT REJECTED:', json.rejection_reason);
      throw new Error(json.rejection_reason);
    }
    
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