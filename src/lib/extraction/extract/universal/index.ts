// src/lib/extraction/extract/universal/index.ts
// Version: 9.0.0 - 2025-12-29
// BREAKING: Pure OCR extraction - removed semantic labels, matches classifier approach

import type { LabeledCriticalImage } from '@/types/classification';
import type { UniversalExtractionResult } from '@/types/extraction';
import { buildPerPageExtractorPrompt } from '../../prompts/universal-extractor-prompt';
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
  console.log(`[extractor:phase1] ${"─".repeat(60)}\n`);
  
  // PHASE 2: POST-PROCESSING MERGE (deterministic logic)
  console.log(`[extractor:phase2] ${"─".repeat(60)}`);
  console.log(`[extractor:phase2] PHASE 2: POST-PROCESSING MERGE`);
  console.log(`[extractor:phase2] ${"─".repeat(60)}`);
  console.log(`[extractor:phase2] Starting merge post-processing...`);
  
  let { 
    finalTerms, 
    provenance, 
    pageExtractions: originalPageExtractions,
    needsReview, 
    needsSecondTurn,
    mergeLog, 
    validationErrors,
    validationWarnings 
  } = mergePageExtractions(pageExtractions);
  
  console.log(`[extractor:phase2] ✅ Merge complete`);
  console.log(`[extractor:phase2] ${"─".repeat(60)}\n`);
  
  // PHASE 3: SECOND-TURN EXTRACTION (if needed)
  if (needsSecondTurn) {
    console.log(`\n[extractor:phase3] ${"─".repeat(60)}`);
    console.log(`[extractor:phase3] PHASE 3: SECOND-TURN EXTRACTION`);
    console.log(`[extractor:phase3] ${"─".repeat(60)}`);
    console.log(`[extractor:phase3] Triggering second-turn extraction...`);
    
    const secondTurnResult = await runSecondTurnExtraction(
      criticalImages,
      pageExtractions,
      validationErrors,
      finalTerms
    );
    
    if (secondTurnResult.success) {
      // Combine second-turn with first-turn instead of replacing
      const combinedExtractions = combinePageExtractions(
        pageExtractions,
        secondTurnResult.pageExtractions
      );
      
      console.log(`[extractor:phase3] Combined ${pageExtractions.length} first-turn + ${secondTurnResult.pageExtractions.length} second-turn = ${combinedExtractions.length} total`);
      
      // Re-merge with combined results
      const secondMerge = mergePageExtractions(combinedExtractions);
      
      finalTerms = secondMerge.finalTerms;
      provenance = secondMerge.provenance;
      pageExtractions = combinedExtractions;
      needsReview = secondMerge.needsReview;
      needsSecondTurn = secondMerge.needsSecondTurn;
      mergeLog = [...mergeLog, '🔄 SECOND TURN APPLIED', ...secondMerge.mergeLog];
      validationErrors = secondMerge.validationErrors;
      validationWarnings = secondMerge.validationWarnings;
      
      console.log(`[extractor:phase3] ✅ Second turn complete - errors resolved`);
    } else {
      console.error(`[extractor:phase3] ❌ Second turn failed:`, secondTurnResult.error);
      mergeLog.push(`❌ Second turn failed: ${secondTurnResult.error}`);
    }
    
    console.log(`[extractor:phase3] ${"─".repeat(60)}\n`);
  }
  
  console.log(`${"═".repeat(80)}`);
  console.log(`║ ✅ EXTRACTION COMPLETE`);
  console.log(`${"═".repeat(80)}`);
  console.log(`Needs Review: ${needsReview}`);
  console.log(`Second Turn Used: ${needsSecondTurn}`);
  console.log(`Validation Errors: ${validationErrors.length}`);
  console.log(`Validation Warnings: ${validationWarnings.length}`);
  console.log(`Merge Log Entries: ${mergeLog.length}`);
  console.log(`${"═".repeat(80)}\n`);
  
  return {
    universal: finalTerms,
    details: {
      provenance,
      pageExtractions,
      mergeLog,
      validationErrors,
      validationWarnings,
    },
    timelineEvents: [],
    needsReview,
  };
}

/**
 * Combine first-turn and second-turn page extractions
 * Second-turn extractions override first-turn for the same pages
 */
function combinePageExtractions(
  firstTurn: PerPageExtraction[],
  secondTurn: PerPageExtraction[]
): PerPageExtraction[] {
  const secondTurnMap = new Map<number, PerPageExtraction>();
  for (const extraction of secondTurn) {
    secondTurnMap.set(extraction.pageNumber, extraction);
  }
  
  const combined = [...firstTurn];
  
  for (let i = 0; i < combined.length; i++) {
    const pageNum = combined[i].pageNumber;
    if (secondTurnMap.has(pageNum)) {
      console.log(`[combineExtractions] Overriding page ${pageNum} with second-turn data`);
      combined[i] = secondTurnMap.get(pageNum)!;
      secondTurnMap.delete(pageNum);
    }
  }
  
  for (const [pageNum, extraction] of secondTurnMap.entries()) {
    console.log(`[combineExtractions] Adding new page ${pageNum} from second-turn`);
    combined.push(extraction);
  }
  
  return combined.sort((a, b) => a.pageNumber - b.pageNumber);
}

/**
 * Extract data from each page independently
 * Pure OCR - no semantic context about document roles
 */
async function extractPerPage(
  criticalImages: LabeledCriticalImage[]
): Promise<PerPageExtraction[]> {
  const prompt = buildPerPageExtractorPrompt(criticalImages);
  
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
          // CRITICAL: Use pure page numbers like classifier does
          // NO semantic labels like "COUNTER OFFER" - just page numbers
          ...criticalImages.flatMap((img, idx) => [
            { 
              type: 'text', 
              text: `\n━━━ IMAGE ${idx + 1} OF ${criticalImages.length} = PDF_Page_${img.pageNumber} ━━━\n` 
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
  const content = data.choices[0].message.content.trim();
  
  console.log(`[extractor:response] Raw response length: ${content.length} chars`);
  console.log(`[extractor:response] First 500 chars: ${content.substring(0, 500)}`);
  
  // Extract JSON array from markdown code blocks or raw response
  let jsonText = content;
  
  // Remove markdown code fences if present
  const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonText = codeBlockMatch[1].trim();
    console.log(`[extractor:parse] Extracted from markdown code block`);
  }
  
  // Try to find JSON array
  const arrayMatch = jsonText.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    jsonText = arrayMatch[0];
    console.log(`[extractor:parse] JSON array found, length: ${jsonText.length} chars`);
  }
  
  let parsed: PerPageExtraction[];
  try {
    parsed = JSON.parse(jsonText);
    console.log(`[extractor:parse] ✅ Parsed ${parsed.length} page extractions`);
  } catch (e: any) {
    console.error(`[extractor:parse] ❌ JSON parse failed:`, e.message);
    console.error(`[extractor:parse] Attempted to parse:`, jsonText.substring(0, 1000));
    throw new Error(`Failed to parse Grok response as JSON: ${e.message}`);
  }
  
  // Log sample for debugging
  if (parsed.length > 0) {
    console.log(`[extractor:sample] Sample extraction (page ${parsed[0].pageNumber}):`);
    console.log(JSON.stringify(parsed[0], null, 2).substring(0, 500));
  }
  
  return parsed;
}