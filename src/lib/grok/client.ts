// src/lib/grok/client.ts
// Version: 5.2.0 - 2026-01-01
// CRITICAL FIX: Made JSON mode conditional based on expectObject
// - JSON mode ONLY works for objects { }, not arrays [ ]
// - Classifier expects object { state, pages } → JSON mode ON
// - Extractor expects array [{}, {}, ...] → JSON mode OFF
// - This fixes extractor returning wrong array (sellerNames instead of page extractions)
// Previous versions:
// - 5.1.0: Removed output prefilling (not supported by xAI)
// - 5.0.0: Added output prefilling (REVERTED - caused parsing failures)
// - 4.0.0: Migrated to OpenAI SDK
// - 3.0.0: Added JSON mode and retry logic with exponential backoff

import OpenAI from 'openai';

// Initialize OpenAI SDK configured for xAI endpoint
const openai = new OpenAI({
  apiKey: process.env.XAI_API_KEY || '',
  baseURL: 'https://api.x.ai/v1',
});

export interface GrokPage {
  pageNumber: number;
  base64: string;
}

export interface GrokCallOptions {
  logPrefix: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  expectObject?: boolean; // true = {}, false = []
}

// ============================================================================
// IMAGE FORMATTING - EXACT COPY FROM CLASSIFIER
// ============================================================================

/**
 * Formats images EXACTLY like the working classifier
 * Pattern: "━━━ IMAGE X OF Y = PDF_Page_N (of TOTAL total) ━━━"
 * 
 * DO NOT MODIFY unless you've tested with real documents!
 */
export function formatImagesForGrokAPI(
  pages: GrokPage[],
  totalPagesInDocument?: number
): Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string } }> {
  
  return pages.flatMap((p, idx) => {
    // Build the EXACT text format from classifier
    let headerText = `\n━━━ IMAGE ${idx + 1} OF ${pages.length} = PDF_Page_${p.pageNumber}`;
    
    // Add total context if provided (classifier does this)
    if (totalPagesInDocument !== undefined) {
      headerText += ` (of ${totalPagesInDocument} total)`;
    }
    
    // Close with separator (classifier does this)
    headerText += ` ━━━`;
    
    return [
      { type: 'text' as const, text: headerText },
      { type: 'image_url' as const, image_url: { url: p.base64 } },
    ];
  });
}

// ============================================================================
// JSON EXTRACTION - EXACT COPY FROM CLASSIFIER
// ============================================================================

/**
 * Extracts JSON using the EXACT bracket-depth algorithm from classifier
 * This is proven to work - DO NOT MODIFY
 */
export function extractJSONFromGrokResponse<T>(
  text: string,
  logPrefix: string,
  expectObject: boolean
): T {
  const openChar = expectObject ? '{' : '[';
  const closeChar = expectObject ? '}' : ']';
  const jsonType = expectObject ? 'object' : 'array';
  
  let parsed = null;
  let depth = 0;
  let startIdx = text.indexOf(openChar);
  
  if (startIdx === -1) {
    console.error(`${logPrefix}:parse] ❌ No opening ${jsonType} bracket found in response`);
    throw new Error(`No JSON ${jsonType} found in response`);
  }

  console.log(`${logPrefix}:parse] JSON starts at index ${startIdx}`);
  
  // EXACT algorithm from classifier - bracket depth tracking
  for (let i = startIdx; i < text.length; i++) {
    if (text[i] === openChar) depth++;
    if (text[i] === closeChar) depth--;
    if (depth === 0) {
      const jsonStr = text.substring(startIdx, i + 1);
      console.log(`${logPrefix}:parse] Extracted JSON string length: ${jsonStr.length}`);
      
      try {
        parsed = JSON.parse(jsonStr);
        console.log(`${logPrefix}:parse] ✅ JSON parsed successfully`);
        break;
      } catch (e) {
        console.warn(`${logPrefix}:parse] ⚠️ Parse attempt failed at position ${i}`);
      }
    }
  }
  
  if (!parsed) {
    console.error(`${logPrefix}:parse] ❌ All parse attempts failed`);
    console.error(`${logPrefix}:parse] Raw response (first 2000):`, text.substring(0, 2000));
    console.error(`${logPrefix}:parse] Raw response (last 500):`, text.substring(text.length - 500));
    throw new Error('Could not parse JSON from response');
  }
  
  return parsed as T;
}

// ============================================================================
// MAIN API CALL - EXACT COPY FROM CLASSIFIER
// ============================================================================

/**
 * Sends images to Grok using the EXACT pattern from the working classifier
 * Returns parsed JSON or throws error
 * 
 * v2.2.0: Enhanced response logging to show full JSON objects
 */
export async function callGrokAPI<T>(
  prompt: string,
  pages: GrokPage[],
  options: GrokCallOptions,
  totalPagesInDocument?: number
): Promise<T> {
  
  const {
    logPrefix,
    model = 'grok-4-1-fast-reasoning',
    temperature = 0,
    maxTokens = 6144, // CHANGED: Reduced from 16384 to 6144 for cost optimization
    expectObject = false,
  } = options;
  
  console.log(`${logPrefix}:api] Sending request to Grok...`);

  // STEP 1: Build request body with conditional JSON mode
  // CRITICAL: JSON mode only works for objects { }, not arrays [ ]
  // - Classifier expects object: { state, pages } → JSON mode ON
  // - Extractor expects array: [ {}, {}, ... ] → JSON mode OFF
  const requestBody: any = {
    model,
    temperature,
    max_tokens: maxTokens,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          ...formatImagesForGrokAPI(pages, totalPagesInDocument),
        ],
      },
    ],
  };

  // Only enable JSON mode for objects (not arrays)
  if (expectObject) {
    requestBody.response_format = { type: 'json_object' };
    console.log(`${logPrefix}:api] JSON mode: ENABLED (expecting object)`);
  } else {
    console.log(`${logPrefix}:api] JSON mode: DISABLED (expecting array)`);
  }

  console.log(`${logPrefix}:api] Request content blocks: ${requestBody.messages[0].content.length}`);
  console.log(`${logPrefix}:api] Max tokens: ${maxTokens}`);

  // STEP 2: Call Grok API via OpenAI SDK
  let data;
  try {
    data = await openai.chat.completions.create(requestBody as any);
    console.log(`${logPrefix}:api] Response received successfully`);
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    const statusCode = error?.status || 'unknown';
    console.error(`${logPrefix}:api] ❌ Grok API error ${statusCode}:`, errorMessage);
    throw new Error(`Grok API error ${statusCode}: ${errorMessage}`);
  }

  // STEP 3: Extract response content
  const text = data.choices[0].message.content;
  if (!text) {
    console.error(`${logPrefix}:api] ❌ Empty response content from Grok`);
    throw new Error('Empty response content from Grok API');
  }

  console.log(`${logPrefix}:response] Raw response length: ${text.length} chars`);
  console.log(`${logPrefix}:response] First 300 chars:`, text.substring(0, 300));
  console.log(`${logPrefix}:response] Last 200 chars:`, text.substring(text.length - 200));

  // STEP 4: Extract JSON from response
  const json = extractJSONFromGrokResponse<T>(text, logPrefix, expectObject);
  
  // ============================================================================
  // v2.2.0: ENHANCED LOGGING - Show actual parsed JSON structure
  // ============================================================================
  console.log(`\n${logPrefix}:parsed] ${"═".repeat(70)}`);
  console.log(`${logPrefix}:parsed] PARSED JSON STRUCTURE`);
  console.log(`${logPrefix}:parsed] ${"═".repeat(70)}`);
  
  if (Array.isArray(json)) {
    console.log(`${logPrefix}:parsed] Type: Array with ${json.length} items`);

    // DEBUGGING MODE: Show ALL items (split across multiple log lines for Vercel 4KB limit)
    console.log(`${logPrefix}:parsed] ⚠️ DEBUG MODE: Showing all ${json.length} items`);
    for (let i = 0; i < json.length; i++) {
      console.log(`${logPrefix}:parsed] ─────────────────────────────────────────`);
      console.log(`${logPrefix}:parsed] Item ${i + 1}/${json.length}:`);
      console.log(JSON.stringify(json[i], null, 2));
    }
    console.log(`${logPrefix}:parsed] ─────────────────────────────────────────`);

    // Show summary of all items
    console.log(`${logPrefix}:parsed] Summary of all ${json.length} items:`);
    json.forEach((item: any, idx: number) => {
      if (typeof item === 'object' && item !== null) {
        const keys = Object.keys(item);
        const nonNullKeys = keys.filter(k => item[k] !== null && item[k] !== undefined);
        console.log(`${logPrefix}:parsed]   [${idx}] ${nonNullKeys.length}/${keys.length} fields with data`);
        if (item.pageNumber) console.log(`${logPrefix}:parsed]       pageNumber: ${item.pageNumber}`);
        if (item.pageLabel) console.log(`${logPrefix}:parsed]       pageLabel: "${item.pageLabel}"`);
        if (item.pageRole) console.log(`${logPrefix}:parsed]       pageRole: ${item.pageRole}`);
      }
    });
    
  } else if (typeof json === 'object' && json !== null) {
    console.log(`${logPrefix}:parsed] Type: Object`);
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log(`${logPrefix}:parsed] Type: ${typeof json}`);
    console.log(`${logPrefix}:parsed] Value:`, json);
  }
  
  console.log(`${logPrefix}:parsed] ${"═".repeat(70)}\n`);
  
  return json;
}

// ============================================================================
// RETRY LOGIC WITH EXPONENTIAL BACKOFF
// ============================================================================

/**
 * Calls Grok API with retry logic and exponential backoff
 * Retries on network errors and rate limits (429)
 * Does NOT retry on validation errors (content_filter, invalid prompts)
 *
 * v3.0.0: Added retry logic for production reliability
 */
export async function callGrokAPIWithRetry<T>(
  prompt: string,
  pages: GrokPage[],
  options: GrokCallOptions,
  totalPagesInDocument?: number,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await callGrokAPI<T>(prompt, pages, options, totalPagesInDocument);
    } catch (error) {
      lastError = error as Error;
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Don't retry on validation/content errors - these won't fix themselves
      if (
        errorMessage.includes('content_filter') ||
        errorMessage.includes('invalid') ||
        errorMessage.includes('bad request')
      ) {
        console.error(`${options.logPrefix}:retry] Non-retryable error: ${errorMessage}`);
        throw error;
      }

      // Retry on network/rate limit errors
      if (attempt < maxRetries) {
        const backoffMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s, 8s
        console.warn(
          `${options.logPrefix}:retry] Attempt ${attempt + 1}/${maxRetries} failed: ${errorMessage}`
        );
        console.warn(`${options.logPrefix}:retry] Retrying in ${backoffMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      } else {
        console.error(`${options.logPrefix}:retry] All ${maxRetries + 1} attempts failed`);
      }
    }
  }

  throw lastError!;
}

/**
 * Enhanced version with both retry AND validation
 * Use this for maximum reliability
 */
export async function callGrokAPIWithRetryAndValidation<T>(
  prompt: string,
  pages: GrokPage[],
  options: GrokCallOptions,
  totalPagesInDocument?: number,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await callGrokAPIWithValidation<T>(prompt, pages, options, totalPagesInDocument);
    } catch (error) {
      lastError = error as Error;
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Don't retry on validation/content errors
      if (
        errorMessage.includes('content_filter') ||
        errorMessage.includes('invalid') ||
        errorMessage.includes('bad request') ||
        errorMessage.includes('truncated') // Don't retry truncation - need to increase max_tokens
      ) {
        console.error(`${options.logPrefix}:retry] Non-retryable error: ${errorMessage}`);
        throw error;
      }

      // Retry on network/rate limit errors
      if (attempt < maxRetries) {
        const backoffMs = Math.pow(2, attempt) * 1000;
        console.warn(
          `${options.logPrefix}:retry] Attempt ${attempt + 1}/${maxRetries} failed: ${errorMessage}`
        );
        console.warn(`${options.logPrefix}:retry] Retrying in ${backoffMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      } else {
        console.error(`${options.logPrefix}:retry] All ${maxRetries + 1} attempts failed`);
      }
    }
  }

  throw lastError!;
}

// ============================================================================
// OPTIONAL: VALIDATION (Can add later if needed)
// ============================================================================

/**
 * Validates response has finish_reason = "stop"
 * Catches truncation bugs if output hits max_tokens
 */
export function validateFinishReason(
  data: any,
  logPrefix: string
): void {
  const finishReason = data?.choices?.[0]?.finish_reason;
  
  if (!finishReason) {
    console.warn(`${logPrefix}:validate] ⚠️ No finish_reason in response`);
    return;
  }
  
  console.log(`${logPrefix}:validate] Finish reason: ${finishReason}`);
  
  if (finishReason === 'length') {
    console.error(`${logPrefix}:validate] ❌ RESPONSE TRUNCATED - hit max_tokens!`);
    throw new Error('Response truncated due to max_tokens limit');
  }
  
  if (finishReason === 'content_filter') {
    console.error(`${logPrefix}:validate] ❌ Blocked by content filter`);
    throw new Error('Response blocked by content filter');
  }
  
  if (finishReason !== 'stop') {
    console.warn(`${logPrefix}:validate] ⚠️ Unexpected finish_reason: ${finishReason}`);
  }
}

/**
 * Enhanced version of callGrokAPI with validation
 * Use this if you want the safety checks without changing the core pattern
 */
export async function callGrokAPIWithValidation<T>(
  prompt: string,
  pages: GrokPage[],
  options: GrokCallOptions,
  totalPagesInDocument?: number
): Promise<T> {
  
  const {
    logPrefix,
    model = 'grok-4-1-fast-reasoning',
    temperature = 0,
    maxTokens = 6144, // CHANGED: Reduced from 16384 to 6144
    expectObject = false,
  } = options;
  
  console.log(`${logPrefix}:api] Sending request to Grok...`);

  // Build request body with conditional JSON mode
  const requestBody: any = {
    model,
    temperature,
    max_tokens: maxTokens,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          ...formatImagesForGrokAPI(pages, totalPagesInDocument),
        ],
      },
    ],
  };

  // Only enable JSON mode for objects (not arrays)
  if (expectObject) {
    requestBody.response_format = { type: 'json_object' };
    console.log(`${logPrefix}:api] JSON mode: ENABLED (expecting object)`);
  } else {
    console.log(`${logPrefix}:api] JSON mode: DISABLED (expecting array)`);
  }

  console.log(`${logPrefix}:api] Request content blocks: ${requestBody.messages[0].content.length}`);
  console.log(`${logPrefix}:api] Max tokens: ${maxTokens}`);

  // Call Grok API via OpenAI SDK
  let data;
  try {
    data = await openai.chat.completions.create(requestBody as any);
    console.log(`${logPrefix}:api] Response received successfully`);
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    const statusCode = error?.status || 'unknown';
    console.error(`${logPrefix}:api] ❌ Grok API error ${statusCode}:`, errorMessage);
    throw new Error(`Grok API error ${statusCode}: ${errorMessage}`);
  }

  // ✨ ADDED: Validation check (not in original classifier)
  validateFinishReason(data, logPrefix);

  // Extract response content
  const text = data.choices[0].message.content;
  if (!text) {
    console.error(`${logPrefix}:api] ❌ Empty response content from Grok`);
    throw new Error('Empty response content from Grok API');
  }

  console.log(`${logPrefix}:response] Raw response length: ${text.length} chars`);
  console.log(`${logPrefix}:response] First 300 chars:`, text.substring(0, 300));
  console.log(`${logPrefix}:response] Last 200 chars:`, text.substring(text.length - 200));

  const json = extractJSONFromGrokResponse<T>(text, logPrefix, expectObject);
  
  return json;
}