// src/lib/extraction/classify/classifier.ts
// Version: 6.2.0 - 2025-12-24
// ENHANCED: Deep debugging at every classification step

import { buildClassifierPrompt } from '../prompts';
import {
  mergeDetectedPages,
  getCriticalPageNumbers,
  buildUniversalPageLabels,
  buildLabeledCriticalImages,
  extractPackageMetadata,
} from './post-processor';

import type { 
  GrokPageResult, 
  GrokClassifierOutput, 
  LabeledCriticalImage 
} from '../../../types/classification';

console.log('[classifier:init] XAI_API_KEY present:', !!process.env.XAI_API_KEY);

function logDataShape(label: string, data: any) {
  console.log(`\n┌─── ${label} ${"─".repeat(Math.max(0, 60 - label.length))}`);
  
  if (data === null) {
    console.log(`│ null`);
  } else if (data === undefined) {
    console.log(`│ undefined`);
  } else if (Array.isArray(data)) {
    console.log(`│ Array[${data.length}]`);
    if (data.length > 0) {
      console.log(`│ Sample item:`, JSON.stringify(data[0], null, 2).substring(0, 150));
    }
  } else if (typeof data === 'object') {
    console.log(`│ Object keys: [${Object.keys(data).join(', ')}]`);
  } else {
    console.log(`│ ${typeof data}: ${String(data).substring(0, 100)}`);
  }
  
  console.log(`└${"─".repeat(63)}\n`);
}

const chunk = <T>(arr: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  );

async function classifyBatch(
  batch: { pageNumber: number; base64: string }[],
  batchIndex: number,
  totalBatches: number,
  totalPages: number
): Promise<{ batchStartPage: number; result: GrokClassifierOutput } | null> {
  const start = batch[0].pageNumber;
  const end = batch[batch.length - 1].pageNumber;

  console.log(`\n${"═".repeat(80)}`);
  console.log(`║ BATCH ${batchIndex + 1}/${totalBatches}: Pages ${start}–${end}`);
  console.log(`${"═".repeat(80)}`);

  console.log(`[batch${batchIndex + 1}:input] Pages in batch: ${batch.length}`);
  batch.forEach((page, idx) => {
    console.log(`[batch${batchIndex + 1}:input]   ${idx + 1}. Page ${page.pageNumber} - base64 length: ${page.base64.length}`);
  });

  const batchPrompt = buildClassifierPrompt(start, end, batch.length);
  console.log(`[batch${batchIndex + 1}:prompt] Prompt length: ${batchPrompt.length} chars`);

  try {
    console.log(`[batch${batchIndex + 1}:api] Sending request to Grok...`);
    
    const requestBody = {
      model: 'grok-4-1-fast-reasoning',
      temperature: 0,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: batchPrompt },
            ...batch.flatMap((p, idx) => [
              { 
                type: 'text', 
                text: `\n━━━ IMAGE ${idx + 1} OF ${batch.length} = PDF_Page_${p.pageNumber} (of ${totalPages} total) ━━━` 
              },
              { type: 'image_url', image_url: { url: p.base64 } },
            ]),
          ],
        },
      ],
    };

    console.log(`[batch${batchIndex + 1}:api] Request content blocks: ${requestBody.messages[0].content.length}`);

    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.XAI_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    console.log(`[batch${batchIndex + 1}:api] Response status: ${res.status}`);

    if (!res.ok) {
      const text = await res.text();
      console.error(`[batch${batchIndex + 1}:api] ❌ Grok error ${res.status}:`, text.substring(0, 500));
      return null;
    }

    const data = await res.json();
    const text = data.choices[0].message.content;

    console.log(`[batch${batchIndex + 1}:response] Raw response length: ${text.length} chars`);
    console.log(`[batch${batchIndex + 1}:response] First 300 chars:`, text.substring(0, 300));
    console.log(`[batch${batchIndex + 1}:response] Last 200 chars:`, text.substring(text.length - 200));

    let json: GrokClassifierOutput;
    try {
      // Try multiple JSON extraction strategies
      let parsed = null;
      
      let depth = 0;
      let startIdx = text.indexOf('{');
      
      if (startIdx === -1) {
        console.error(`[batch${batchIndex + 1}:parse] ❌ No opening brace found in response`);
        throw new Error('No JSON found in response');
      }

      console.log(`[batch${batchIndex + 1}:parse] JSON starts at index ${startIdx}`);
      
      for (let i = startIdx; i < text.length; i++) {
        if (text[i] === '{') depth++;
        if (text[i] === '}') depth--;
        if (depth === 0) {
          const jsonStr = text.substring(startIdx, i + 1);
          console.log(`[batch${batchIndex + 1}:parse] Extracted JSON string length: ${jsonStr.length}`);
          
          try {
            parsed = JSON.parse(jsonStr);
            console.log(`[batch${batchIndex + 1}:parse] ✅ JSON parsed successfully`);
            break;
          } catch (e) {
            console.warn(`[batch${batchIndex + 1}:parse] ⚠️ Parse attempt failed at position ${i}`);
          }
        }
      }
      
      if (!parsed) {
        console.error(`[batch${batchIndex + 1}:parse] ❌ All parse attempts failed`);
        throw new Error('Could not parse JSON from response');
      }
      
      json = parsed;

      logDataShape(`Batch ${batchIndex + 1} Parsed JSON`, json);

      if (!json.pages || !Array.isArray(json.pages)) {
        console.error(`[batch${batchIndex + 1}:validate] ❌ Missing or invalid pages array`);
        console.error(`[batch${batchIndex + 1}:validate] Parsed object:`, JSON.stringify(json, null, 2).substring(0, 500));
        throw new Error('Invalid schema — missing pages array');
      }

      const detectedCount = json.pages.filter((p) => p !== null).length;
      console.log(`[batch${batchIndex + 1}:validate] ✅ Schema valid`);
      console.log(`[batch${batchIndex + 1}:validate] Pages array length: ${json.pages.length}`);
      console.log(`[batch${batchIndex + 1}:validate] Non-null pages: ${detectedCount}`);
      
      // Log each detected page
      json.pages.forEach((page, idx) => {
        if (page !== null) {
          console.log(`[batch${batchIndex + 1}:page${idx + 1}]`, {
            pdfPage: page.pdfPage,
            formCode: page.formCode,
            role: page.role,
            contentCategory: page.contentCategory,
            hasFilledFields: page.hasFilledFields,
            confidence: page.confidence,
          });
        } else {
          console.log(`[batch${batchIndex + 1}:page${idx + 1}] null (no form detected)`);
        }
      });

    } catch (err: any) {
      console.error(`[batch${batchIndex + 1}:parse] ❌ JSON parse/validation failed:`, err.message);
      console.error(`[batch${batchIndex + 1}:parse] Raw response (first 2000):`, text.substring(0, 2000));
      console.error(`[batch${batchIndex + 1}:parse] Raw response (last 500):`, text.substring(text.length - 500));
      return null;
    }

    console.log(`[batch${batchIndex + 1}] ✅ Batch complete\n`);
    return { batchStartPage: start, result: json };
    
  } catch (error: any) {
    console.error(`[batch${batchIndex + 1}:error] ❌ Request failed:`, error.message);
    console.error(`[batch${batchIndex + 1}:error] Stack:`, error.stack);
    return null;
  }
}

export async function classifyCriticalPages(
  pages: { pageNumber: number; base64: string }[],
  totalPages: number
): Promise<{
  criticalImages: LabeledCriticalImage[];
  state: string;
  criticalPageNumbers: number[];
  packageMetadata: ReturnType<typeof extractPackageMetadata>;
}> {
  console.log(`\n${"═".repeat(80)}`);
  console.log(`║ 🔍 CLASSIFIER STARTED`);
  console.log(`${"═".repeat(80)}`);

  if (!pages?.length) {
    console.error(`[classifier] ❌ Invalid pages array`);
    throw new Error('classifyCriticalPages received invalid pages array');
  }

  logDataShape("Input Pages Array", pages);
  console.log(`[classifier:input] Total pages: ${totalPages}`);
  console.log(`[classifier:input] Pages array length: ${pages.length}`);

  const BATCH_SIZE = 15;
  const batches = chunk(pages, BATCH_SIZE);

  console.log(`[classifier:batch] Creating ${batches.length} batches of ≤${BATCH_SIZE} pages`);
  batches.forEach((batch, idx) => {
    console.log(`[classifier:batch]   Batch ${idx + 1}: ${batch.length} pages (${batch[0].pageNumber}–${batch[batch.length - 1].pageNumber})`);
  });

  const startTime = Date.now();
  console.log(`[classifier:grok] Starting parallel Grok requests...`);

  const results = await Promise.allSettled(
    batches.map((batch, i) => classifyBatch(batch, i, batches.length, totalPages))
  );

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[classifier:grok] ✅ All batches complete in ${elapsed}s`);

  // Log result status
  results.forEach((result, idx) => {
    if (result.status === 'fulfilled') {
      console.log(`[classifier:results] Batch ${idx + 1}: ${result.value ? '✅ success' : '❌ null result'}`);
    } else {
      console.log(`[classifier:results] Batch ${idx + 1}: ❌ rejected - ${result.reason}`);
    }
  });

  const validResults = results
    .filter(
      (r): r is PromiseFulfilledResult<{ batchStartPage: number; result: GrokClassifierOutput } | null> =>
        r.status === 'fulfilled'
    )
    .map((r) => r.value)
    .filter((r): r is { batchStartPage: number; result: GrokClassifierOutput } => r !== null);

  console.log(`[classifier:results] Valid results: ${validResults.length}/${batches.length}`);

  if (validResults.length === 0) {
    console.error(`[classifier:results] ❌ No valid classification results from any batch`);
    throw new Error('No valid classification results from any batch');
  }

  // Reconstruct full page array
  console.log(`[classifier:merge] Reconstructing full page array (${totalPages} pages)...`);
  const allGrokPages: (GrokPageResult | null)[] = new Array(totalPages).fill(null);

  validResults.forEach(({ batchStartPage, result }) => {
    console.log(`[classifier:merge] Processing batch starting at page ${batchStartPage}`);
    
    result.pages.forEach((page, indexInBatch) => {
      const actualPdfPage = batchStartPage + indexInBatch;

      if (page !== null) {
        let correctedPage = page;
        
        if (page.pdfPage !== actualPdfPage) {
          console.warn(
            `[classifier:merge] ⚠️ Page mismatch: Grok said ${page.pdfPage}, correcting to ${actualPdfPage}`
          );
          correctedPage = { ...page, pdfPage: actualPdfPage };
        }

        allGrokPages[actualPdfPage - 1] = correctedPage;
        console.log(`[classifier:merge]   Stored page ${actualPdfPage} (index ${actualPdfPage - 1})`);
      } else {
        allGrokPages[actualPdfPage - 1] = null;
        console.log(`[classifier:merge]   Page ${actualPdfPage} is null`);
      }
    });
  });

  console.log(`[classifier:merge] Full array reconstructed`);
  const nonNullCount = allGrokPages.filter(p => p !== null).length;
  console.log(`[classifier:merge] Non-null pages: ${nonNullCount}/${totalPages}`);

  // Post-processing
  console.log(`[classifier:post] Running post-processing...`);
  
  const detectedPages = mergeDetectedPages(allGrokPages);
  logDataShape("Detected Pages (after merge)", detectedPages);
  console.log(`[classifier:post] Detected pages: ${detectedPages.length}`);

  const criticalPageNumbers = getCriticalPageNumbers(detectedPages);
  logDataShape("Critical Page Numbers", criticalPageNumbers);
  console.log(`[classifier:post] Critical pages selected: ${criticalPageNumbers.length}`);

  const labelMap = buildUniversalPageLabels(detectedPages, criticalPageNumbers);
  console.log(`[classifier:post] Labels built for ${labelMap.size} pages`);

  const criticalImages = buildLabeledCriticalImages(pages, criticalPageNumbers, labelMap);
  logDataShape("Critical Images (labeled)", criticalImages);
  console.log(`[classifier:post] Critical images ready: ${criticalImages.length}`);

  const packageMetadata = extractPackageMetadata(detectedPages);
  logDataShape("Package Metadata", packageMetadata);

  console.log(`\n${"═".repeat(80)}`);
  console.log(`║ ✅ CLASSIFICATION COMPLETE`);
  console.log(`${"═".repeat(80)}`);
  console.log(`   Form codes: ${packageMetadata.detectedFormCodes.join(', ') || 'none'}`);
  console.log(`   Pages with footers: ${packageMetadata.totalDetectedPages}`);
  console.log(`   Multiple forms: ${packageMetadata.hasMultipleForms}`);
  console.log(`   Critical pages: ${criticalPageNumbers.length}`);
  console.log(`   Labeled images: ${criticalImages.length}`);
  console.log(`${"═".repeat(80)}\n`);

  return {
    state: 'Unknown',
    criticalPageNumbers,
    criticalImages,
    packageMetadata,
  };
}