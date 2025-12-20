// src/lib/extractor/extractor.ts
// Version: 2.3.0 - 2025-12-20
// UPDATED: Graceful Zod validation with partial results

import OpenAI from "openai";
import { ExtractionSchema } from "./schema";
import { EXTRACTOR_PROMPT, SECOND_TURN_PROMPT } from "./prompts";

interface LabeledImage {
  pageNumber: number;
  base64: string;
  label: string;
}

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
        image_url: { url: img.base64 },
      },
    ]),
  ];

  console.log(`[extractor] Sending ${images.length} images to Grok 4.1`);

  const response = await client.chat.completions.create({
    model: "grok-4-1-fast-reasoning",
    temperature: 0,
    max_tokens: 4096,
    messages: [{ role: "user", content }],
    response_format: { type: "json_object" },
  });

  const rawContent = response.choices[0].message.content;
  if (!rawContent) {
    throw new Error("Empty response from Grok");
  }

  let json: unknown;
  try {
    json = JSON.parse(rawContent);
  } catch (e) {
    console.error("[extractor] Failed to parse Grok response as JSON:", rawContent.substring(0, 500));
    throw new Error("Invalid JSON from model");
  }

  // Attempt Zod validation
  const parsed = ExtractionSchema.safeParse(json);
  
  if (!parsed.success) {
    console.error("[extractor] ⚠️ Zod validation failed:");
    console.error(JSON.stringify(parsed.error.format(), null, 2));
    
    // Log what Grok actually returned
    console.log("[extractor] Raw Grok response:");
    console.log(JSON.stringify(json, null, 2).substring(0, 1000));
    
    // Try to extract partial data with lower confidence
    // This requires the raw JSON to at least have the basic structure
    const rawData = json as any;
    
    if (rawData.extracted && rawData.confidence) {
      console.warn("[extractor] ⚠️ Returning partial data with NEEDS_REVIEW flag");
      
      return {
        extracted: rawData.extracted,
        confidence: {
          ...rawData.confidence,
          overall_confidence: Math.min(rawData.confidence.overall_confidence || 0, 70), // Cap at 70
        },
        handwriting_detected: rawData.handwriting_detected || false,
        raw: {
          ...rawData,
          _zod_validation_failed: true,
          _zod_errors: parsed.error.format(),
        },
      };
    }
    
    // If we can't extract anything useful, throw
    throw new Error("Extraction failed schema validation - invalid data structure");
  }

  const result = parsed.data;

  const lowConfidence =
    result.confidence.overall_confidence < 80 ||
    result.confidence.purchase_price < 90 ||
    result.confidence.buyer_names < 90 ||
    result.handwriting_detected;

  if (lowConfidence) {
    console.warn("[extractor] ⚠️ Low confidence or handwriting → will route to NEEDS_REVIEW");
  }

  return {
    extracted: result.extracted,
    confidence: result.confidence,
    handwriting_detected: result.handwriting_detected,
    raw: result,
  };
}