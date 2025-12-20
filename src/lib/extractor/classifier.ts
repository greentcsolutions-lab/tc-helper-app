// src/lib/extractor/classifier.ts
// Version: 3.3.0 - 2025-12-20
// UPDATED: pages_in_this_batch support + BATCH_SIZE=15 + best inference merge

import { buildClassifierPrompt } from "./prompts";
import { RPA_FORM } from "./form-definitions";

console.log("[classifier] XAI_API_KEY present:", !!process.env.XAI_API_KEY);
console.log("[classifier] First 10 chars:", process.env.XAI_API_KEY?.slice(0, 10));

const chunk = <T>(arr: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  );

interface ClassificationResult {
  pages_in_this_batch: number;
  total_document_pages: number;
  rpa_pages: {
    page_1_at_pdf_page: number | null;
    page_2_at_pdf_page: number | null;
    page_3_at_pdf_page: number | null;
    page_16_at_pdf_page: number | null;
    page_17_at_pdf_page: number | null;
  };
  counter_offer_pages: number[];
  addendum_pages: number[];
}

async function classifyBatch(
  batch: { pageNumber: number; base64: string }[],
  batchIndex: number,
  totalBatches: number,
  totalPages: number,
  fullPrompt: string
): Promise<Partial<ClassificationResult>> {
  const start = batch[0].pageNumber;
  const end = batch[batch.length - 1].pageNumber;

  console.log(`[classifier:batch${batchIndex + 1}] Processing pages ${start}–${end}`);

  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.XAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "grok-4-1-fast-reasoning",
        temperature: 0,
        max_tokens: 1024,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: fullPrompt },
            ...batch.flatMap(p => [
              {
                type: "text",
                text: `\n━━━ Image ${p.pageNumber}/${totalPages} ━━━`
              },
              {
                type: "image_url",
                image_url: { url: p.base64 }
              }
            ])
          ]
        }]
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[classifier:batch${batchIndex + 1}] Grok error:`, res.status, text);
      return {};
    }

    const data = await res.json();
    const text = data.choices[0].message.content;
    
    console.log(`[classifier:batch${batchIndex + 1}] Raw response (first 200 chars):`, text.substring(0, 200));

    let json: Partial<ClassificationResult>;
    try {
      const jsonMatch = text.match(/{[\s\S]*}/)?.[0];
      if (!jsonMatch) {
        console.error(`[classifier:batch${batchIndex + 1}] No JSON found in response. Full text:`, text);
        return {};
      }
      json = JSON.parse(jsonMatch);

      // Log batch size for observability
      console.log(`[classifier:batch${batchIndex + 1}] Reported ${json.pages_in_this_batch} pages (sent ${batch.length})`);
    } catch (err) {
      console.error(`[classifier:batch${batchIndex + 1}] JSON parse failed. Full text:`, text);
      return {};
    }

    if (!json || typeof json !== 'object') {
      console.error(`[classifier:batch${batchIndex + 1}] Invalid response structure:`, json);
      return {};
    }

    console.log(`[classifier:batch${batchIndex + 1}] ✓ Pages ${start}–${end} classified`);

    return json;
  } catch (error: any) {
    console.error(`[classifier:batch${batchIndex + 1}] Request failed:`, error.message);
    return {};
  }
}

export async function classifyCriticalPages(
  pages: { pageNumber: number; base64: string }[],
  totalPages: number
): Promise<{
  criticalImages: { pageNumber: number; base64: string }[];
  state: string;
  criticalPageNumbers: number[];
}> {
  if (!pages || !Array.isArray(pages) || pages.length === 0) {
    throw new Error("classifyCriticalPages received invalid pages array");
  }

  const BATCH_SIZE = 15;

  const batches = chunk(pages, BATCH_SIZE);
  const fullPrompt = buildClassifierPrompt(totalPages);

  console.log(`[classifier] Starting PARALLEL classification: ${pages.length} full pages @ 120 DPI → ${batches.length} batches of ~${BATCH_SIZE}`);
  console.log(`[classifier] Grok will analyze BOTTOM 15% of each page for footer patterns`);
  const startTime = Date.now();

  const results = await Promise.allSettled(
    batches.map((batch, i) => classifyBatch(batch, i, batches.length, totalPages, fullPrompt))
  );

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[classifier] ✓ All batches complete in ${elapsed}s`);
  
  const { validateRPABlock } = await import('./sequential-validator');

  const aggregated: ClassificationResult = {
    pages_in_this_batch: 0, // not used in aggregate
    total_document_pages: totalPages,
    rpa_pages: {
      page_1_at_pdf_page: null,
      page_2_at_pdf_page: null,
      page_3_at_pdf_page: null,
      page_16_at_pdf_page: null,
      page_17_at_pdf_page: null,
    },
    counter_offer_pages: [],
    addendum_pages: [],
  };

  // Best-inference merge
  const validInferences = results
    .filter((r): r is PromiseFulfilledResult<Partial<ClassificationResult>> => 
      r.status === 'fulfilled' && r.value && Object.keys(r.value).length > 0)
    .map(r => r.value)
    .filter(inf => inf.rpa_pages && (
      inf.rpa_pages.page_1_at_pdf_page ||
      inf.rpa_pages.page_2_at_pdf_page ||
      inf.rpa_pages.page_3_at_pdf_page ||
      inf.rpa_pages.page_16_at_pdf_page ||
      inf.rpa_pages.page_17_at_pdf_page
    ))
    .sort((a, b) => {
      const score = (inf: Partial<ClassificationResult>) => {
        if (inf.rpa_pages?.page_1_at_pdf_page) return 100;
        if (inf.rpa_pages?.page_2_at_pdf_page) return 90;
        if (inf.rpa_pages?.page_3_at_pdf_page) return 50;
        return Object.values(inf.rpa_pages || {}).filter(v => v !== null).length;
      };
      return score(b) - score(a);
    });

  if (validInferences.length > 0) {
  const best = validInferences[0].rpa_pages!;
  console.log(`[classifier] 🎯 Using best RPA inference`);
  console.log(`    → RPA: 1@${best.page_1_at_pdf_page} 2@${best.page_2_at_pdf_page} 3@${best.page_3_at_pdf_page} 16@${best.page_16_at_pdf_page} 17@${best.page_17_at_pdf_page}`);

  // ←←← FIX: Direct assignment instead of object replacement
  aggregated.rpa_pages.page_1_at_pdf_page = best.page_1_at_pdf_page ?? null;
  aggregated.rpa_pages.page_2_at_pdf_page = best.page_2_at_pdf_page ?? null;
  aggregated.rpa_pages.page_3_at_pdf_page = best.page_3_at_pdf_page ?? null;
  aggregated.rpa_pages.page_16_at_pdf_page = best.page_16_at_pdf_page ?? null;
  aggregated.rpa_pages.page_17_at_pdf_page = best.page_17_at_pdf_page ?? null;
} else {
  console.warn('[classifier] ⚠ No valid RPA inference found across any batch');
}

  // Collect counters/addenda from all batches
  results.forEach(result => {
    if (result.status === 'fulfilled' && result.value) {
      const data = result.value;
      if (data.counter_offer_pages?.length) {
        aggregated.counter_offer_pages.push(...data.counter_offer_pages);
      }
      if (data.addendum_pages?.length) {
        aggregated.addendum_pages.push(...data.addendum_pages);
      }
    }
  });

  aggregated.counter_offer_pages = [...new Set(aggregated.counter_offer_pages)];
  aggregated.addendum_pages = [...new Set(aggregated.addendum_pages)];

  // ... rest of validation and logging unchanged (same as previous version)
  // (criticalPagesSet, validateRPABlock, logging, return, etc.)

  const criticalPagesSet = new Set<number>();

  Object.values(aggregated.rpa_pages).forEach(page => {
    if (page !== null) criticalPagesSet.add(page);
  });

  aggregated.counter_offer_pages.forEach(page => criticalPagesSet.add(page));
  aggregated.addendum_pages.forEach(page => criticalPagesSet.add(page));

  const criticalPageNumbers = Array.from(criticalPagesSet)
    .filter(page => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);

  const rpaBlock = validateRPABlock(aggregated.rpa_pages);
  
  if (!rpaBlock.isValid) {
    console.error('[classifier] ✗ CRITICAL: RPA block validation failed');
    console.error('[classifier] Missing pages:', rpaBlock.gaps);
    throw new Error(`Missing required RPA pages: ${rpaBlock.gaps.join(', ')}`);
  }

  if (!rpaBlock.isSequential) {
    console.warn('[classifier] ⚠ RPA pages not sequential - extraction may be less accurate');
  }

  // ... dev debugging and detailed logging unchanged ...

  const criticalImages = pages.filter(p => criticalPageNumbers.includes(p.pageNumber));

  return {
    state: "California",
    criticalPageNumbers,
    criticalImages,
  };
}