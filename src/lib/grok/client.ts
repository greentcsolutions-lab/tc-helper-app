// src/lib/grok/client.ts
// Version: 2.0.0 - 2025-12-30
// MINIMAL & PROVEN: Extracts ONLY the working parts from classifier
// NO extra features - just the exact pattern that works 90% of the time

// ============================================================================
// CORE PRINCIPLE: Copy the classifier's exact approach, nothing more
// ============================================================================

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
 * This function is a direct extraction of classifyBatch() logic
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
    maxTokens = 16384,
    expectObject = false,
  } = options;
  
  console.log(`${logPrefix}:api] Sending request to Grok...`);
  
  // STEP 1: Build request body EXACTLY like classifier
  const requestBody = {
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
  
  console.log(`${logPrefix}:api] Request content blocks: ${requestBody.messages[0].content.length}`);
  
  // STEP 2: Fetch EXACTLY like classifier
  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.XAI_API_KEY}`,
    },
    body: JSON.stringify(requestBody),
  });
  
  console.log(`${logPrefix}:api] Response status: ${res.status}`);
  
  // STEP 3: Error handling EXACTLY like classifier
  if (!res.ok) {
    const text = await res.text();
    console.error(`${logPrefix}:api] ❌ Grok error ${res.status}:`, text.substring(0, 500));
    throw new Error(`Grok API error ${res.status}: ${text}`);
  }
  
  // STEP 4: Parse response EXACTLY like classifier
  const data = await res.json();
  const text = data.choices[0].message.content;
  
  console.log(`${logPrefix}:response] Raw response length: ${text.length} chars`);
  console.log(`${logPrefix}:response] First 300 chars:`, text.substring(0, 300));
  console.log(`${logPrefix}:response] Last 200 chars:`, text.substring(text.length - 200));
  
  // STEP 5: Extract JSON EXACTLY like classifier
  const json = extractJSONFromGrokResponse<T>(text, logPrefix, expectObject);
  
  return json;
}

// ============================================================================
// OPTIONAL: VALIDATION (Can add later if needed)
// ============================================================================

/**
 * Validates response has finish_reason = "stop"
 * This is NOT in the current classifier, but would catch truncation bugs
 * 
 * ONLY USE if you want to add validation to the working pattern
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
    maxTokens = 16384,
    expectObject = false,
  } = options;
  
  console.log(`${logPrefix}:api] Sending request to Grok...`);
  
  const requestBody = {
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
  
  console.log(`${logPrefix}:api] Request content blocks: ${requestBody.messages[0].content.length}`);
  
  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.XAI_API_KEY}`,
    },
    body: JSON.stringify(requestBody),
  });
  
  console.log(`${logPrefix}:api] Response status: ${res.status}`);
  
  if (!res.ok) {
    const text = await res.text();
    console.error(`${logPrefix}:api] ❌ Grok error ${res.status}:`, text.substring(0, 500));
    throw new Error(`Grok API error ${res.status}: ${text}`);
  }
  
  const data = await res.json();
  
  // ✨ ADDED: Validation check (not in original classifier)
  validateFinishReason(data, logPrefix);
  
  const text = data.choices[0].message.content;
  
  console.log(`${logPrefix}:response] Raw response length: ${text.length} chars`);
  console.log(`${logPrefix}:response] First 300 chars:`, text.substring(0, 300));
  console.log(`${logPrefix}:response] Last 200 chars:`, text.substring(text.length - 200));
  
  const json = extractJSONFromGrokResponse<T>(text, logPrefix, expectObject);
  
  return json;
}