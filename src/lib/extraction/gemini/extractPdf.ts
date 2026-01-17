// src/lib/extraction/gemini/extractPdf.ts
// Version: 2.0.0 - 2026-01-15
// MODULARIZED: Uses shared extraction schema and transformation logic
// Extracts structured timeline data (how dates are calculated, not the calculations themselves)

import { GoogleGenerativeAI } from '@google/generative-ai';
import { EXTRACTION_SCHEMA, getExtractionPrompt } from '@/lib/extraction/shared/extraction-schema';
import { transformToUniversal } from '@/lib/extraction/shared/transform-to-universal';
import { extractJsonFromResponse } from '@/lib/extraction/shared/extract-json';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
if (!GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY is required');
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// ── Quick availability check ─────────────────────────────────────────────────
export async function checkGeminiAvailability(modelName: string = 'gemini-3-flash-preview', timeoutMs = 5000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const model = genAI.getGenerativeModel({ model: modelName });
    const testPromise = model.generateContent('ping').then(() => {
      clearTimeout(timeoutId);
      return true;
    });

    const result = await Promise.race([
      testPromise,
      new Promise<boolean>((_, reject) =>
        setTimeout(() => reject(new Error('Gemini ping timeout')), timeoutMs)
      )
    ]);

    return result;
  } catch (err: any) {
    console.warn(`[gemini-check] Availability check failed: ${err.message}`);
    return false;
  }
}

export async function extractWithGemini(
  pdfUrl: string,
  totalPages: number,
  modelName: string = 'gemini-3-flash-preview'
): Promise<{
  finalTerms: any;
  needsReview: boolean;
  criticalPages: string[];
  allExtractions: any[];
  modelUsed: string;
}> {
  console.log(`[gemini-extract] Starting extraction for ${totalPages}-page document using model: ${modelName}`);
  console.log(`[gemini-extract] PDF URL: ${pdfUrl}`);

  try {
    // Fetch PDF
    console.log(`[gemini-extract] Fetching PDF from URL...`);
    const pdfResponse = await fetch(pdfUrl);
    if (!pdfResponse.ok) {
      throw new Error(`Failed to fetch PDF: ${pdfResponse.status} ${pdfResponse.statusText}`);
    }
    const pdfBuffer = await pdfResponse.arrayBuffer();
    const pdfBase64 = Buffer.from(pdfBuffer).toString('base64');
    console.log(`[gemini-extract] PDF fetched: ${(pdfBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`);

    // Initialize model with tuning for Lite fallback
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: modelName.includes('lite')
        ? {
            temperature: 0.1,
            topP: 0.95,
            // Add thinking_level: 'minimal' here if your SDK version supports it
          }
        : undefined,
    });

    console.log(`[gemini-extract] Sending request to ${modelName} at ${new Date().toISOString()}...`);

    const startTime = Date.now();

    // Use shared extraction prompt
    const schemaJson = JSON.stringify(EXTRACTION_SCHEMA, null, 2);
    const extractionPrompt = getExtractionPrompt(schemaJson);

    const result = await model.generateContent([
      {
        inlineData: {
          data: pdfBase64,
          mimeType: 'application/pdf'
        }
      },
      extractionPrompt
    ]);

    const durationMs = Date.now() - startTime;
    console.log(`[gemini-extract] Response received from ${modelName} after ${durationMs}ms at ${new Date().toISOString()}`);

    const response = result.response;
    const text = response.text();
    console.log(`[gemini-extract] Received response (${text.length} chars)`);
    console.log(`[gemini-extract] First 500 chars: ${text.substring(0, 500)}`);

    // Robust JSON parsing (using shared utility for multiple wrapper formats)
    let extractedData;
    try {
      extractedData = extractJsonFromResponse(text);
    } catch (parseError: any) {
      console.error(`[gemini-extract] JSON parse error:`, parseError);
      console.error(`[gemini-extract] Raw text:`, text);
      throw new Error(`Failed to parse Gemini response as JSON: ${parseError.message}`);
    }

    console.log(`[gemini-extract] Successfully parsed extraction data`);
    console.log(`[gemini-extract] Overall confidence: ${extractedData.confidence?.overall_confidence}%`);

    const finalTerms = transformToUniversal(extractedData);

    const needsReview =
      extractedData.confidence?.overall_confidence < 80 ||
      !extractedData.extracted?.buyer_names?.length ||
      !extractedData.extracted?.property_address?.full ||
      !extractedData.extracted?.purchase_price;

    console.log(`[gemini-extract] Extraction complete - needsReview: ${needsReview}`);

    return {
      finalTerms,
      needsReview,
      criticalPages: ['1-' + totalPages],
      allExtractions: [extractedData],
      modelUsed: modelName,
    };
  } catch (error: any) {
    console.error(`[gemini-extract] Error with ${modelName}:`, error);
    throw new Error(`Gemini extraction failed (${modelName}): ${error.message}`);
  }
}
