// src/lib/extraction/claude/extractPdf.ts
// Version: 3.0.0 - 2026-01-15
// MODULARIZED: Uses shared extraction schema and transformation logic
// AI now extracts HOW dates are calculated (relative vs specified) without performing calculations

import { EXTRACTION_SCHEMA, getExtractionPrompt } from '@/lib/extraction/shared/extraction-schema';
import { transformToUniversal } from '@/lib/extraction/shared/transform-to-universal';
import { extractJsonFromResponse } from '@/lib/extraction/shared/extract-json';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;
if (!ANTHROPIC_API_KEY) {
  throw new Error('ANTHROPIC_API_KEY is required');
}

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01'; // Update if Anthropic releases a newer version

// ── Quick availability check ─────────────────────────────────────────────────
export async function checkClaudeAvailability(modelName: string = 'claude-haiku-4-5-20251001', timeoutMs = 5000): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        max_tokens: 1,
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: 'Ping',
          },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '(no details)');
      throw new Error(`Ping failed: ${response.status} - ${errorText}`);
    }

    return true;
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.warn(`[claude-check] Availability check failed: ${err.message}`);
    throw err;
  }
}

// ── Main extraction function ────────────────────────────────────────────────
export async function extractWithClaude(
  pdfUrl: string,
  totalPages: number,
  modelName: string = 'claude-haiku-4-5-20251001'
): Promise<{
  finalTerms: any;
  needsReview: boolean;
  criticalPages: string[];
  allExtractions: any[];
  modelUsed: string;
}> {
  console.log(`[claude-extract] Starting extraction for ${totalPages}-page document using model: ${modelName}`);
  console.log(`[claude-extract] PDF URL: ${pdfUrl}`);

  // Use shared extraction schema and prompt
  const schemaJson = JSON.stringify(EXTRACTION_SCHEMA, null, 2);
  const extractionPrompt = getExtractionPrompt(schemaJson);

  // Define the cached system block
  const STATIC_SYSTEM_BLOCKS = [
    {
      type: 'text',
      text: extractionPrompt,
      cache_control: { type: 'ephemeral' } // 5-minute TTL, auto-refreshes on hits
    }
  ];

  try {
    // Step 1: Quick availability check
    console.log(`[claude-extract] Quick availability check (max 5s)...`);
    await checkClaudeAvailability(modelName, 5000);
    console.log(`[claude-extract] Claude is responding ✓ Proceeding`);

    // Step 2: Fetch PDF
    console.log(`[claude-extract] Fetching PDF from URL...`);
    const pdfResponse = await fetch(pdfUrl);
    if (!pdfResponse.ok) {
      throw new Error(`Failed to fetch PDF: ${pdfResponse.status} ${pdfResponse.statusText}`);
    }
    const pdfBuffer = await pdfResponse.arrayBuffer();
    const pdfBase64 = Buffer.from(pdfBuffer).toString('base64');
    console.log(`[claude-extract] PDF fetched: ${(pdfBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`);

    console.log(`[claude-extract] Sending request with cached prompt to ${modelName}...`);

    const startTime = Date.now();

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        max_tokens: 8192, // Increased from 4096 to allow for longer reasoning + JSON output
        temperature: 0.1,
        system: STATIC_SYSTEM_BLOCKS,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: pdfBase64,
                },
              },
              {
                type: 'text',
                text: 'Extract structured data from this PDF according to the schema and rules. Use scratchpad for reasoning, then output ONLY the JSON inside <json> tags with no additional text.',
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Claude API error: ${response.status} - ${errorBody}`);
    }

    const result = await response.json();
    const durationMs = Date.now() - startTime;
    console.log(`[claude-extract] Response received after ${durationMs}ms`);

    // Log cache usage and stop reason
    console.log('[claude-extract] Usage stats:', JSON.stringify(result.usage, null, 2));
    console.log(`[claude-extract] Stop reason: ${result.stop_reason}`);

    // Check if response was cut off before JSON output
    if (result.stop_reason === 'max_tokens') {
      console.warn('[claude-extract] ⚠️ Response hit max_tokens limit - may be incomplete!');
    }

    const text = result.content[0].text;
    console.log(`[claude-extract] Received response (${text.length} chars)`);

    // ── JSON extraction (using shared utility for robust parsing) ──────────────
    let extractedData;
    try {
      extractedData = extractJsonFromResponse(text);
      console.log(`[claude-extract] Successfully extracted JSON`);
    } catch (parseError: any) {
      console.error(`[claude-extract] JSON extraction failed:`, parseError);
      console.error(`[claude-extract] Raw response preview:`, text.substring(0, 1200));
      throw new Error(`Failed to parse JSON: ${parseError.message}`);
    }

    console.log(`[claude-extract] Overall confidence: ${extractedData.confidence?.overall_confidence}%`);

    const finalTerms = transformToUniversal(extractedData);

    const needsReview =
      extractedData.confidence?.overall_confidence < 80 ||
      !extractedData.extracted?.buyer_names?.length ||
      !extractedData.extracted?.property_address?.full ||
      !extractedData.extracted?.purchase_price;

    console.log(`[claude-extract] Extraction complete - needsReview: ${needsReview}`);

    return {
      finalTerms,
      needsReview,
      criticalPages: ['1-' + totalPages],
      allExtractions: [extractedData],
      modelUsed: modelName,
    };
  } catch (error: any) {
    console.error(`[claude-extract] Error with ${modelName}:`, error);

    if (error.message.includes('Ping failed') || error.message.includes('AbortError')) {
      throw new Error(`Claude appears to be down or not responding right now`);
    }

    throw new Error(`Claude extraction failed (${modelName}): ${error.message}`);
  }
}
