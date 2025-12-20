// src/lib/extractor/extractor.ts
// Version: 2.2.0 - 2025-12-20
// UPDATED: Passes explicit RPA page labels to extraction phase
import OpenAI from "openai";
import { ExtractionSchema } from "./schema";
import { EXTRACTOR_PROMPT, SECOND_TURN_PROMPT } from "./prompts";

interface LabeledImage {
  pageNumber: number;
  base64: string;
  label: string;
}

// Create client with xAI base URL
const client = new OpenAI({
  apiKey: process.env.XAI_API_KEY!,
  baseURL: "https://api.x.ai/v1",
});

export async function extractFromCriticalPages(
  images: LabeledImage[],
  previousResult?: any
) {
  if (images.length > 7) {
    console.warn(`[extractor] ${images.length} images > 7 → consider splitting for speed`);
  }

  let promptText = EXTRACTOR_PROMPT;
  if (previousResult) {
    promptText = SECOND_TURN_PROMPT.replace(
      "{{PREVIOUS_JSON}}",
      JSON.stringify(previousResult, null, 2)
    );
  }

  const content = [
    { type: "text" as const, text: promptText },
    ...images.flatMap((img) => [
      {
        type: "text" as const,
        text: `\n━━━ ${img.label} ━━━\nCarefully read all filled fields on this page. Override prior terms if this is a counter or addendum.`,
      },
      {
        type: "image_url" as const,
        image_url: { url: `data:image/png;base64,${img.base64}` }, // OpenAI format
      },
    ]),
  ];

  const response = await client.chat.completions.create({
    model: "grok-4-1-fast-reasoning", // or "grok-4" if you prefer more reasoning
    temperature: 0,
    max_tokens: 4096,
    messages: [{ role: "user", content }],
    response_format: { type: "json_object"},
  });

  const rawContent = response.choices[0].message.content;
  if (!rawContent) {
    throw new Error("Empty response from Grok");
  }

  let json: unknown;
  try {
    json = JSON.parse(rawContent);
  } catch (e) {
    console.error("[extractor] Failed to parse Grok response as JSON:", rawContent);
    throw new Error("Invalid JSON from model");
  }

  const parsed = ExtractionSchema.safeParse(json);
  if (!parsed.success) {
    console.error("[extractor] Schema validation failed:", parsed.error.format());
    throw new Error("Extraction failed schema validation");
  }

  const result = parsed.data;

  // Your existing gate logic
  const lowConfidence =
    result.confidence.overall_confidence < 80 ||
    result.confidence.purchase_price < 90 ||
    result.confidence.buyer_names < 90 ||
    result.handwriting_detected;

  if (lowConfidence) {
    console.warn("[extractor] Low confidence or handwriting → route to human review");
  }

  return {
    extracted: result.extracted,
    confidence: result.confidence,
    handwriting_detected: result.handwriting_detected,
    raw: result,
  };
}