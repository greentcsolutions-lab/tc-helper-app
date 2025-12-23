// src/lib/extraction/classify/classifier.ts
// Version: 6.0.1 - 2025-12-23
// FIXED: Safer page correction (immutable), clearer image markers for Grok
// Universal classifier: no state-specific assumptions
// Handles Grok sweep only — all merging, critical page selection, and labeling moved to post-processor.ts

import { buildClassifierPrompt } from '../prompts';
import {
  mergeDetectedPages,
  getCriticalPageNumbers,
  buildUniversalPageLabels,
  buildLabeledCriticalImages,
  extractPackageMetadata,
} from './post-processor';

console.log('[classifier] XAI_API_KEY present:', !!process.env.XAI_API_KEY);

const chunk = <T>(arr: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  );

// === GROK OUTPUT SCHEMA (simple per-page sweep) ===
interface GrokPageResult {
  pdfPage: number;
  formCode: string;        // any string — e.g., "RPA", "TREC", "FARBAR", "CUSTOM"
  formPage: number;
  footerText: string;
}

interface GrokClassifierOutput {
  pages: (GrokPageResult | null)[];
}

// === FINAL EXTRACTOR INPUT ===
export interface LabeledCriticalImage {
  pageNumber: number;
  base64: string;
  label: string;
}

async function classifyBatch(
  batch: { pageNumber: number; base64: string }[],
  batchIndex: number,
  totalBatches: number,
  totalPages: number
): Promise<{ batchStartPage: number; result: GrokClassifierOutput } | null> {
  const start = batch[0].pageNumber;
  const end = batch[batch.length - 1].pageNumber;

  console.log(`[classifier:batch${batchIndex + 1}] Processing pages ${start}–${end}`);

  const batchPrompt = buildClassifierPrompt(start, end, batch.length);

  try {
    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.XAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'grok-vision-beta',
        temperature: 0,
        max_tokens: 1024,
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
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[classifier:batch${batchIndex + 1}] Grok error:`, res.status, text);
      return null;
    }

    const data = await res.json();
    const text = data.choices[0].message.content;

    let json: GrokClassifierOutput;
    try {
      const jsonMatch = text.match(/{[\s\S]*}/)?.[0];
      if (!jsonMatch) throw new Error('No JSON found in response');
      json = JSON.parse(jsonMatch);

      if (!json.pages || !Array.isArray(json.pages)) {
        throw new Error('Invalid schema — missing pages array');
      }

      const detectedCount = json.pages.filter((p) => p !== null).length;
      console.log(`[classifier:batch${batchIndex + 1}] Parsed: ${detectedCount}/${json.pages.length} pages with form footers`);
    } catch (err) {
      console.error(`[classifier:batch${batchIndex + 1}] JSON parse/validation failed`);
      return null;
    }

    console.log(`[classifier:batch${batchIndex + 1}] ✓ Pages ${start}–${end} classified`);
    return { batchStartPage: start, result: json };
  } catch (error: any) {
    console.error(`[classifier:batch${batchIndex + 1}] Request failed:`, error.message);
    return null;
  }
}

/**
 * Main exported function — runs the full classification sweep and returns universal results
 */
export async function classifyCriticalPages(
  pages: { pageNumber: number; base64: string }[],
  totalPages: number
): Promise<{
  criticalImages: LabeledCriticalImage[];
  state: string; // currently "Unknown" — future prompt can improve this
  criticalPageNumbers: number[];
  packageMetadata: ReturnType<typeof extractPackageMetadata>;
}> {
  if (!pages?.length) {
    throw new Error('classifyCriticalPages received invalid pages array');
  }

  const BATCH_SIZE = 15;
  const batches = chunk(pages, BATCH_SIZE);

  console.log(`[classifier] 🔍 PHASE 1: Grok sweep — ${batches.length} batches of ≤${BATCH_SIZE} pages`);
  const startTime = Date.now();

  const results = await Promise.allSettled(
    batches.map((batch, i) => classifyBatch(batch, i, batches.length, totalPages))
  );

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[classifier] ✓ Grok sweep complete in ${elapsed}s`);

  const validResults = results
    .filter(
      (r): r is PromiseFulfilledResult<{ batchStartPage: number; result: GrokClassifierOutput } | null> =>
        r.status === 'fulfilled'
    )
    .map((r) => r.value)
    .filter((r): r is { batchStartPage: number; result: GrokClassifierOutput } => r !== null);

  if (validResults.length === 0) {
    throw new Error('No valid classification results from any batch');
  }

  // Reconstruct full page array (0-indexed) with proper absolute page numbers
  const allGrokPages: (GrokPageResult | null)[] = new Array(totalPages).fill(null);

  validResults.forEach(({ batchStartPage, result }) => {
    result.pages.forEach((page, indexInBatch) => {
      const actualPdfPage = batchStartPage + indexInBatch;

      if (page !== null) {
        // FIXED: Create new immutable object with corrected page number
        let correctedPage = page;
        
        if (page.pdfPage !== actualPdfPage) {
          console.warn(
            `[classifier] ⚠️ Page mismatch: Grok said ${page.pdfPage}, correcting to ${actualPdfPage}`
          );
          correctedPage = { ...page, pdfPage: actualPdfPage };
        }

        allGrokPages[actualPdfPage - 1] = correctedPage; // 1-based → 0-indexed
      } else {
        allGrokPages[actualPdfPage - 1] = null;
      }
    });
  });

  // === UNIVERSAL POST-PROCESSING (delegated) ===
  const detectedPages = mergeDetectedPages(allGrokPages);
  const criticalPageNumbers = getCriticalPageNumbers(detectedPages);
  const labelMap = buildUniversalPageLabels(detectedPages, criticalPageNumbers);
  const criticalImages = buildLabeledCriticalImages(pages, criticalPageNumbers, labelMap);
  const packageMetadata = extractPackageMetadata(detectedPages);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[classifier] 📋 UNIVERSAL CLASSIFICATION RESULTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`   Detected form codes: ${packageMetadata.detectedFormCodes.join(', ') || 'none'}`);
  console.log(`   Pages with footers: ${packageMetadata.totalDetectedPages}`);
  console.log(`   Multiple form types: ${packageMetadata.hasMultipleForms}`);
  console.log(`   Critical pages selected: ${criticalPageNumbers.length}`);
  console.log(`   Labeled images ready: ${criticalImages.length}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  return {
    state: 'Unknown', // Placeholder — can be enhanced later via prompt
    criticalPageNumbers,
    criticalImages,
    packageMetadata,
  };
}