// src/lib/extraction/extract/universal/index.ts
// Version: 9.2.0 - 2025-12-30
// FIXED: Removed semantic labels to match manual Grok test (pure OCR, numbered images only)

import type { LabeledCriticalImage } from '@/types/classification';
import type { UniversalExtractionResult } from '@/types/extraction';
import { buildUniversalExtractorPrompt } from '../../prompts/universal-extractor-prompt';
import { mergePageExtractions, type PerPageExtraction } from './post-processor';
import { runSecondTurnExtraction } from './second-turn';

export async function universalExtractor(
  criticalImages: LabeledCriticalImage[],
  packageMetadata: any
): Promise<{
  universal: UniversalExtractionResult;
  details: {
    provenance: Record<string, number>;
    pageExtractions: PerPageExtraction[];
    mergeLog: string[];
    validationErrors: string[];
    validationWarnings: string[];
  } | null;
  timelineEvents: any[];
  needsReview: boolean;
}> {
  console.log(`\n${"═".repeat(80)}`);
  console.log(`║ 🤖 UNIVERSAL EXTRACTOR STARTED (PURE OCR MODE)`);
  console.log(`${"═".repeat(80)}`);
  console.log(`[extractor] Critical images: ${criticalImages.length}`);
  
  // PHASE 1: PER-PAGE EXTRACTION (Pure OCR - no context pollution)
  console.log(`\n[extractor:phase1] ${"─".repeat(60)}`);
  console.log(`[extractor:phase1] PHASE 1: PURE PER-PAGE EXTRACTION`);
  console.log(`[extractor:phase1] ${"─".repeat(60)}`);
  console.log(`[extractor:phase1] Starting pure OCR extraction...`);
  
  let pageExtractions = await extractPerPage(criticalImages);
  
  console.log(`[extractor:phase1] ✅ Extracted ${pageExtractions.length} pages`);
  console.log(`\n[extractor:debug] ${"─".repeat(60)}`);
  console.log(`[extractor:debug] RAW PER-PAGE EXTRACTIONS`);
  console.log(`[extractor:debug] ${"─".repeat(60)}`);
  
  pageExtractions.forEach((extraction, idx) => {
    console.log(`\n[extractor:debug] Page ${extraction.pageNumber}:`);
    console.log(`  Label: ${extraction.pageLabel}`);
    console.log(`  Role: ${extraction.pageRole}`);
    console.log(`  Form: ${extraction.formCode} (page ${extraction.formPage})`);
    console.log(`  Confidence: ${extraction.confidence.overall}`);
    
    const fieldsWithData = Object.entries(extraction)
      .filter(([key, value]) => 
        !['pageNumber', 'pageLabel', 'formCode', 'formPage', 'pageRole', 'confidence'].includes(key) &&
        value != null &&
        (typeof value !== 'object' || Object.keys(value).length > 0) &&
        (!Array.isArray(value) || value.length > 0)
      );
    
    if (fieldsWithData.length > 0) {
      console.log(`  Fields with data (${fieldsWithData.length}):`);
      fieldsWithData.forEach(([key]) => console.log(`    - ${key}`));
    } else {
      console.log(`  No data fields extracted`);
    }
  });
  
  // PHASE 2: MERGE + POST-PROCESS
  console.log(`\n[extractor:phase2] ${"─".repeat(60)}`);
  console.log(`[extractor:phase2] PHASE 2: MERGE & POST-PROCESS`);
  console.log(`[extractor:phase2] ${"─".repeat(60)}`);
  console.log(`[extractor:phase2] Starting merge process...`);
  
  const mergeResult = mergePageExtractions(pageExtractions);
  
  console.log(`[extractor:phase2] ✅ Merge complete`);
  console.log(`[extractor:phase2] Needs review: ${mergeResult.needsReview}`);
  console.log(`[extractor:phase2] Needs second turn: ${mergeResult.needsSecondTurn}`);
  
  // PHASE 3: SECOND TURN (if needed)
  if (mergeResult.needsSecondTurn) {
    console.log(`\n[extractor:phase3] ${"─".repeat(60)}`);
    console.log(`[extractor:phase3] PHASE 3: SECOND TURN EXTRACTION`);
    console.log(`[extractor:phase3] ${"─".repeat(60)}`);
    console.log(`[extractor:phase3] Validation errors detected, running second turn...`);
    
    const secondTurnResult = await runSecondTurnExtraction(
      criticalImages,
      pageExtractions,
      mergeResult.validationErrors,
      mergeResult.finalTerms
    );
    
    if (secondTurnResult.success) {
      console.log(`[extractor:phase3] Second turn returned ${secondTurnResult.pageExtractions.length} extractions`);
      
      // Combine first + second turn
      pageExtractions = combineExtractions(pageExtractions, secondTurnResult.pageExtractions);
      
      console.log(`[extractor:phase3] Re-merging with second turn data...`);
      const secondMerge = mergePageExtractions(pageExtractions);
      
      console.log(`[extractor:phase3] Second merge complete`);
      console.log(`[extractor:phase3] Needs review: ${secondMerge.needsReview}`);
      
      // Return second merge results
      console.log(`\n${"═".repeat(80)}`);
      console.log(`║ ✅ UNIVERSAL EXTRACTION COMPLETE (SECOND TURN)`);
      console.log(`${"═".repeat(80)}\n`);
      
      return {
        universal: secondMerge.finalTerms,
        details: {
          provenance: secondMerge.provenance,
          pageExtractions: secondMerge.pageExtractions,
          mergeLog: secondMerge.mergeLog,
          validationErrors: secondMerge.validationErrors,
          validationWarnings: secondMerge.validationWarnings,
        },
        timelineEvents: [],
        needsReview: secondMerge.needsReview,
      };
    } else {
      console.error(`[extractor:phase3] ❌ Second turn failed:`, secondTurnResult.error);
      // Continue with first-turn results
    }
  }
  
  // Return first-pass results
  console.log(`\n${"═".repeat(80)}`);
  console.log(`║ ✅ UNIVERSAL EXTRACTION COMPLETE (SINGLE PASS)`);
  console.log(`${"═".repeat(80)}\n`);
  
  return {
    universal: mergeResult.finalTerms,
    details: {
      provenance: mergeResult.provenance,
      pageExtractions: mergeResult.pageExtractions,
      mergeLog: mergeResult.mergeLog,
      validationErrors: mergeResult.validationErrors,
      validationWarnings: mergeResult.validationWarnings,
    },
    timelineEvents: [],
    needsReview: mergeResult.needsReview,
  };
}

/**
 * Combines first-turn and second-turn extractions
 * Second-turn takes precedence for pages that were re-extracted
 */
function combineExtractions(
  firstTurn: PerPageExtraction[],
  secondTurn: PerPageExtraction[]
): PerPageExtraction[] {
  console.log(`[combineExtractions] Combining ${firstTurn.length} first-turn + ${secondTurn.length} second-turn`);
  
  const combined: PerPageExtraction[] = [];
  const secondTurnMap = new Map(secondTurn.map(e => [e.pageNumber, e]));
  
  // Add all first-turn pages, replacing with second-turn where available
  for (const extraction of firstTurn) {
    if (secondTurnMap.has(extraction.pageNumber)) {
      console.log(`[combineExtractions] Page ${extraction.pageNumber} overridden by second-turn`);
      combined.push(secondTurnMap.get(extraction.pageNumber)!);
      secondTurnMap.delete(extraction.pageNumber);
    } else {
      combined.push(extraction);
    }
  }
  
  // Add any new pages from second-turn
  for (const [pageNum, extraction] of secondTurnMap.entries()) {
    console.log(`[combineExtractions] Adding new page ${pageNum} from second-turn`);
    combined.push(extraction);
  }
  
  return combined.sort((a, b) => a.pageNumber - b.pageNumber);
}

/**
 * Extract data from each page independently
 * Pure OCR - no semantic context about document roles
 * 
 * v9.2.0: Removed semantic labels - matches manual test (pure numbered images)
 */
async function extractPerPage(
  criticalImages: LabeledCriticalImage[]
): Promise<PerPageExtraction[]> {
  const prompt = buildUniversalExtractorPrompt(criticalImages);
  
  console.log(`[extractor:api] Prompt length: ${prompt.length} chars`);
  console.log(`[extractor:api] Sending ${criticalImages.length} images to Grok`);
  
  const requestBody = {
    model: 'grok-4-1-fast-reasoning',
    temperature: 0,
    max_tokens: 16384,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          // v9.2.0 FIX: Match manual test - NO semantic labels, just numbered images
          // "IMAGE 1 OF 11", "IMAGE 2 OF 11", etc.
          // Grok reads the page itself to determine role/form/etc
          ...criticalImages.flatMap((img, idx) => [
            { 
              type: 'text', 
              text: `\n━━━ IMAGE ${idx + 1} OF ${criticalImages.length} ━━━\n` 
            },
            { type: 'image_url', image_url: { url: img.base64 } },
          ]),
        ],
      },
    ],
  };
  
  console.log(`[extractor:api] Request content blocks: ${requestBody.messages[0].content.length}`);
  console.log(`[extractor:api] Sending request to Grok...`);
  
  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.XAI_API_KEY}`,
    },
    body: JSON.stringify(requestBody),
  });
  
  console.log(`[extractor:api] Response status: ${res.status}`);
  
  if (!res.ok) {
    const text = await res.text();
    console.error(`[extractor:api] ❌ Grok error ${res.status}:`, text.substring(0, 500));
    throw new Error(`Grok API error ${res.status}: ${text}`);
  }
  
  const data = await res.json();
  const text = data.choices[0].message.content;
  
  console.log(`[extractor:response] Raw response length: ${text.length} chars`);
  console.log(`[extractor:response] First 300 chars:`, text.substring(0, 300));
  console.log(`[extractor:response] Last 200 chars:`, text.substring(text.length - 200));
  
  // ============================================================================
  // v9.1.0: Use classifier's proven bracket depth tracking algorithm
  // ============================================================================
  
  let parsed: PerPageExtraction[] | null = null;
  
  let depth = 0;
  let startIdx = text.indexOf('[');
  
  if (startIdx === -1) {
    console.error(`[extractor:parse] ❌ No opening bracket found in response`);
    throw new Error('No JSON array found in response');
  }

  console.log(`[extractor:parse] JSON array starts at index ${startIdx}`);
  
  // Walk through the string tracking bracket depth
  for (let i = startIdx; i < text.length; i++) {
    if (text[i] === '[') depth++;
    if (text[i] === ']') depth--;
    if (depth === 0) {
      const jsonStr = text.substring(startIdx, i + 1);
      console.log(`[extractor:parse] Extracted JSON string length: ${jsonStr.length}`);
      
      try {
        parsed = JSON.parse(jsonStr);
        console.log(`[extractor:parse] ✅ JSON parsed successfully`);
        break;
      } catch (e) {
        console.warn(`[extractor:parse] ⚠️ Parse attempt failed at position ${i}`);
        // Continue looking for next valid closing bracket
      }
    }
  }
  
  if (!parsed) {
    console.error(`[extractor:parse] ❌ All parse attempts failed`);
    console.error(`[extractor:parse] Raw response (first 2000):`, text.substring(0, 2000));
    console.error(`[extractor:parse] Raw response (last 500):`, text.substring(text.length - 500));
    throw new Error('Could not parse JSON array from response');
  }
  
  // ============================================================================
  // v9.1.0: Validate array structure
  // ============================================================================
  
  if (!Array.isArray(parsed)) {
    console.error(`[extractor:validation] ❌ Parsed result is not an array`);
    console.error(`[extractor:validation] Type: ${typeof parsed}`);
    throw new Error('Grok response is not an array');
  }
  
  console.log(`[extractor:validation] ✅ Array validated: ${parsed.length} elements`);
  
  if (parsed.length === 0) {
    console.error(`[extractor:validation] ❌ Array is empty`);
    throw new Error('Grok returned empty array');
  }
  
  // Validate first element has required fields
  const firstElement = parsed[0];
  const requiredFields = ['pageNumber', 'pageLabel', 'formCode', 'pageRole'];
  const missingFields = requiredFields.filter(field => !(field in firstElement));
  
  if (missingFields.length > 0) {
    console.error(`[extractor:validation] ❌ First element missing fields: ${missingFields.join(', ')}`);
    console.error(`[extractor:validation] First element:`, JSON.stringify(firstElement, null, 2).substring(0, 500));
    throw new Error(`Invalid extraction format: missing ${missingFields.join(', ')}`);
  }
  
  console.log(`[extractor:validation] Sample (page ${firstElement.pageNumber}):`);
  console.log(JSON.stringify(firstElement, null, 2).substring(0, 500));
  
  console.log(`[extractor:parse] ✅ Successfully extracted ${parsed.length} page extractions`);
  
  return parsed;
}