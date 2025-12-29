// src/lib/extraction/extract/universal/index.ts
// Version: 8.0.0 - 2025-12-29
// BREAKING: Fixed Issue #2 & #5 - Proper details structure + second-turn implementation

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
    provenance: Record<string, number>;  // field → pageNumber
    pageExtractions: PerPageExtraction[];  // FIX #2: For field provenance building
    mergeLog: string[];
    validationErrors: string[];
    validationWarnings: string[];
  } | null;
  timelineEvents: any[];
  needsReview: boolean;
}> {
  console.log(`\n${"═".repeat(80)}`);
  console.log(`║ 🤖 UNIVERSAL EXTRACTOR STARTED (PER-PAGE MODE)`);
  console.log(`${"═".repeat(80)}`);
  console.log(`[extractor] Critical images: ${criticalImages.length}`);
  
  // PHASE 1: PER-PAGE EXTRACTION (Grok does OCR only)
  console.log(`\n[extractor:phase1] ${"─".repeat(60)}`);
  console.log(`[extractor:phase1] PHASE 1: PER-PAGE EXTRACTION`);
  console.log(`[extractor:phase1] ${"─".repeat(60)}`);
  console.log(`[extractor:phase1] Starting per-page extraction...`);
  
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
  
  // PHASE 3: SECOND-TURN EXTRACTION (FIX #5 - if needed)
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
      // Re-merge with second-turn results
      const secondMerge = mergePageExtractions(secondTurnResult.pageExtractions);
      
      finalTerms = secondMerge.finalTerms;
      provenance = secondMerge.provenance;
      pageExtractions = secondTurnResult.pageExtractions;
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
  console.log(`   Needs Review: ${needsReview}`);
  console.log(`   Second Turn Used: ${needsSecondTurn}`);
  console.log(`   Validation Errors: ${validationErrors.length}`);
  console.log(`   Validation Warnings: ${validationWarnings.length}`);
  console.log(`   Merge Log Entries: ${mergeLog.length}`);
  console.log(`${"═".repeat(80)}\n`);
  
  return {
    universal: finalTerms,
    details: {
      provenance,
      pageExtractions,  // FIX #2: Return for field provenance building
      mergeLog,
      validationErrors,
      validationWarnings,
    },
    timelineEvents: [],
    needsReview,
  };
}

async function extractPerPage(
  criticalImages: LabeledCriticalImage[]
): Promise<PerPageExtraction[]> {
  const imageList = criticalImages.map(img => ({
    pageNumber: img.pageNumber,
    label: img.label,
  }));
  
  const fullPrompt = buildPerPageExtractorPrompt(imageList);
  
  console.log(`[extractor:api] Prompt length: ${fullPrompt.length} chars`);
  console.log(`[extractor:api] Sending ${criticalImages.length} high-DPI images to Grok`);
  
  const requestBody = {
    model: 'grok-4-1-fast-reasoning',
    temperature: 0,
    max_tokens: 8192,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: fullPrompt },
          ...criticalImages.flatMap((img, idx) => [
            { 
              type: 'text', 
              text: `\n━━━ IMAGE ${idx + 1} OF ${criticalImages.length} ━━━\nPage ${img.pageNumber}: ${img.label}\nExtract ONLY what's visible on THIS page:\n` 
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
  console.log(`[extractor:response] First 500 chars:`, content.substring(0, 500));
  
  // Extract JSON array
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.error(`[extractor:parse] ❌ No JSON array found in response`);
    console.error(`[extractor:parse] Full response:`, content);
    throw new Error('No JSON array found in Grok response');
  }
  
  console.log(`[extractor:parse] JSON array found, length: ${jsonMatch[0].length} chars`);
  
  let parsed: PerPageExtraction[];
  try {
    parsed = JSON.parse(jsonMatch[0]);
    console.log(`[extractor:parse] ✅ Parsed ${parsed.length} page extractions`);
  } catch (e: any) {
    console.error(`[extractor:parse] ❌ JSON parse failed:`, e.message);
    console.error(`[extractor:parse] JSON string:`, jsonMatch[0].substring(0, 1000));
    throw new Error(`Failed to parse Grok response: ${e.message}`);
  }
  
  // Validate structure
  if (!Array.isArray(parsed) || parsed.length === 0) {
    console.error(`[extractor:validate] ❌ Invalid response structure`);
    throw new Error('Grok returned invalid array structure');
  }
  
  // Log sample extraction
  if (parsed.length > 0) {
    console.log(`\n[extractor:sample] Sample extraction (page ${parsed[0].pageNumber}):`);
    console.log(JSON.stringify(parsed[0], null, 2).substring(0, 500));
  }
  
  return parsed;
}