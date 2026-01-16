// src/lib/extraction/shared/extract-json.ts
// Version: 1.0.0 - 2026-01-16
// Shared utility to extract JSON from AI responses regardless of wrapper format
// Handles: <json> tags, markdown code blocks, plain JSON

/**
 * Extract JSON from an AI response that may be wrapped in various formats
 * Tries multiple extraction strategies in order of specificity:
 * 1. <json>...</json> tags
 * 2. ```json...``` markdown code blocks
 * 3. ```...``` generic code blocks
 * 4. Plain JSON (starts with { or [)
 *
 * @param text - The raw AI response text
 * @returns The parsed JSON object
 * @throws Error if no valid JSON can be extracted
 */
export function extractJsonFromResponse(text: string): any {
  if (!text || typeof text !== 'string') {
    throw new Error('Invalid input: expected non-empty string');
  }

  const trimmedText = text.trim();

  // Strategy 1: <json>...</json> tags (Claude's preferred format)
  const xmlJsonMatch = trimmedText.match(/<json>([\s\S]*?)<\/json>/);
  if (xmlJsonMatch && xmlJsonMatch[1]) {
    const jsonText = xmlJsonMatch[1].trim();
    try {
      const parsed = JSON.parse(jsonText);
      console.log('[extract-json] Successfully extracted JSON from <json> tags');
      return parsed;
    } catch (e) {
      console.warn('[extract-json] Found <json> tags but content is not valid JSON, trying other methods...');
    }
  }

  // Strategy 2: ```json...``` markdown code blocks (Gemini's common format)
  const markdownJsonMatch = trimmedText.match(/```json\s*\n?([\s\S]*?)\n?\s*```/);
  if (markdownJsonMatch && markdownJsonMatch[1]) {
    const jsonText = markdownJsonMatch[1].trim();
    try {
      const parsed = JSON.parse(jsonText);
      console.log('[extract-json] Successfully extracted JSON from ```json``` code block');
      return parsed;
    } catch (e) {
      console.warn('[extract-json] Found ```json``` block but content is not valid JSON, trying other methods...');
    }
  }

  // Strategy 3: Generic markdown code blocks ```...```
  const genericCodeBlockMatch = trimmedText.match(/```\s*\n?([\s\S]*?)\n?\s*```/);
  if (genericCodeBlockMatch && genericCodeBlockMatch[1]) {
    const jsonText = genericCodeBlockMatch[1].trim();
    try {
      const parsed = JSON.parse(jsonText);
      console.log('[extract-json] Successfully extracted JSON from generic ``` code block');
      return parsed;
    } catch (e) {
      console.warn('[extract-json] Found generic code block but content is not valid JSON, trying other methods...');
    }
  }

  // Strategy 4: Look for JSON object/array in the text
  // Find the first { or [ and try to parse from there
  const jsonStartIndex = Math.min(
    trimmedText.indexOf('{') >= 0 ? trimmedText.indexOf('{') : Infinity,
    trimmedText.indexOf('[') >= 0 ? trimmedText.indexOf('[') : Infinity
  );

  if (jsonStartIndex !== Infinity) {
    const potentialJson = trimmedText.slice(jsonStartIndex);

    // Try to find matching closing bracket
    const isObject = potentialJson[0] === '{';
    const closingChar = isObject ? '}' : ']';

    // Find the last occurrence of the closing character
    const lastClosingIndex = potentialJson.lastIndexOf(closingChar);

    if (lastClosingIndex > 0) {
      const jsonCandidate = potentialJson.slice(0, lastClosingIndex + 1);
      try {
        const parsed = JSON.parse(jsonCandidate);
        console.log('[extract-json] Successfully extracted JSON from raw text (found JSON object/array)');
        return parsed;
      } catch (e) {
        // Try with just the trimmed potential JSON
        try {
          const parsed = JSON.parse(potentialJson.trim());
          console.log('[extract-json] Successfully extracted JSON from trimmed raw text');
          return parsed;
        } catch (e2) {
          // Continue to final fallback
        }
      }
    }
  }

  // Strategy 5: Final attempt - try parsing the entire trimmed text
  try {
    const parsed = JSON.parse(trimmedText);
    console.log('[extract-json] Successfully parsed entire response as JSON');
    return parsed;
  } catch (e) {
    // Provide detailed error with preview of what we received
    const preview = trimmedText.length > 500
      ? trimmedText.substring(0, 500) + '...[truncated]'
      : trimmedText;
    throw new Error(
      `Failed to extract JSON from AI response. ` +
      `Tried: <json> tags, markdown code blocks, raw JSON parsing. ` +
      `Response preview: ${preview}`
    );
  }
}
