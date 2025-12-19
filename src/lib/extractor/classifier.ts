// src/lib/extractor/classifier.ts
// Version: 3.1.0 - 2025-12-19
// FIXED: Added better error logging and response validation
// Form-specific footer matching with PNG tagging + sequential validation
// Optimized for Vercel Hobby 60s timeout with parallel batches

import { buildClassifierPrompt } from "./prompts";
import { RPA_FORM } from "./form-definitions";

console.log("[classifier] XAI_API_KEY present:", !!process.env.XAI_API_KEY);
console.log("[classifier] First 10 chars:", process.env.XAI_API_KEY?.slice(0, 10));

const chunk = <T>(arr: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  );

interface ClassificationResult {
  total_pages_analyzed: number;
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
    } catch (err) {
      console.error(`[classifier:batch${batchIndex + 1}] JSON parse failed. Full text:`, text);
      return {};
    }

    // Validate response structure
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

  const BATCH_SIZE = 6;
  const batches = chunk(pages, BATCH_SIZE);
  const fullPrompt = buildClassifierPrompt(totalPages);

  console.log(`[classifier] Starting PARALLEL classification: ${pages.length} pages → ${batches.length} batches of ~${BATCH_SIZE}`);
  const startTime = Date.now();

  // 🚀 PARALLEL PROCESSING
  const results = await Promise.allSettled(
    batches.map((batch, i) => classifyBatch(batch, i, batches.length, totalPages, fullPrompt))
  );

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[classifier] ✓ All batches complete in ${elapsed}s`);
  
  // Import sequential validator
  const { validateRPABlock } = await import('./sequential-validator');

  // Aggregate results from all successful batches
  const aggregated: ClassificationResult = {
    total_pages_analyzed: totalPages,
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

  let successfulBatches = 0;
  let failedBatches = 0;

  for (const result of results) {
    if (result.status === "rejected") {
      console.warn("[classifier] Batch failed:", result.reason);
      failedBatches++;
      continue;
    }

    const data = result.value;

    if (!data || Object.keys(data).length === 0) {
      console.warn("[classifier] Batch returned empty result");
      failedBatches++;
      continue;
    }

    successfulBatches++;

    // Merge RPA pages (first non-null value wins)
    if (data.rpa_pages) {
      Object.keys(aggregated.rpa_pages).forEach(key => {
        const k = key as keyof typeof aggregated.rpa_pages;
        if (data.rpa_pages![k] && !aggregated.rpa_pages[k]) {
          aggregated.rpa_pages[k] = data.rpa_pages![k];
        }
      });
    }

    // Collect all counter offers and addenda
    if (data.counter_offer_pages) {
      aggregated.counter_offer_pages.push(...data.counter_offer_pages);
    }
    if (data.addendum_pages) {
      aggregated.addendum_pages.push(...data.addendum_pages);
    }
  }

  console.log(`[classifier] Batch results: ${successfulBatches} successful, ${failedBatches} failed`);

  // Flatten all critical pages to single array
  const criticalPagesSet = new Set<number>();

  // Add RPA pages
  Object.values(aggregated.rpa_pages).forEach(page => {
    if (page !== null) criticalPagesSet.add(page);
  });

  // Add counters and addenda
  aggregated.counter_offer_pages.forEach(page => criticalPagesSet.add(page));
  aggregated.addendum_pages.forEach(page => criticalPagesSet.add(page));

  // Validate and sort
  const criticalPageNumbers = Array.from(criticalPagesSet)
    .filter(page => page >= 1 && page <= totalPages) // Remove hallucinations
    .sort((a, b) => a - b);

  // Validate RPA block structure
  const rpaBlock = validateRPABlock(aggregated.rpa_pages);
  
  if (!rpaBlock.isValid) {
    console.error('[classifier] ✗ CRITICAL: RPA block validation failed');
    console.error('[classifier] Missing pages:', rpaBlock.gaps);
    console.error('[classifier] This might be due to:');
    console.error('  1. Footer images too small/blurry (current DPI: 160)');
    console.error('  2. Grok not finding footer text in cropped images');
    console.error('  3. Footer text in unexpected location (not bottom 15%)');
    throw new Error(`Missing required RPA pages: ${rpaBlock.gaps.join(', ')}`);
  }

  if (!rpaBlock.isSequential) {
    console.warn('[classifier] ⚠ RPA pages not sequential - extraction may be less accurate');
  }

  // Visual debugging in development
  if (process.env.NODE_ENV === 'development') {
    const { visualizeClassification, diagnoseClassificationIssues } = await import('./debug-classifier');
    visualizeClassification(totalPages, aggregated.rpa_pages, aggregated.counter_offer_pages, aggregated.addendum_pages);
    
    const issues = diagnoseClassificationIssues(totalPages, aggregated.rpa_pages, aggregated.counter_offer_pages, aggregated.addendum_pages);
    if (issues.length > 0) {
      console.log('[classifier] 🔍 DIAGNOSIS:');
      issues.forEach(issue => console.log(`  ${issue}`));
      console.log();
    }
  }

  // Detailed logging with context
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("[classifier] 📋 CLASSIFICATION RESULTS");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("RPA (Main Contract):");
  Object.entries(aggregated.rpa_pages).forEach(([key, pdfPage]) => {
    const rpaPage = key.match(/page_(\d+)_/)?.[1];
    if (pdfPage) {
      console.log(`  ✓ RPA Page ${rpaPage} → PDF Page ${pdfPage}`);
    } else {
      console.log(`  ✗ RPA Page ${rpaPage} → NOT FOUND`);
    }
  });

  if (aggregated.counter_offer_pages.length > 0) {
    console.log(`\nCounter Offers (${aggregated.counter_offer_pages.length} pages):`);
    console.log(`  → PDF Pages: [${aggregated.counter_offer_pages.sort((a,b) => a-b).join(", ")}]`);
  } else {
    console.log("\nCounter Offers: None found");
  }

  if (aggregated.addendum_pages.length > 0) {
    console.log(`\nAddenda (${aggregated.addendum_pages.length} pages):`);
    console.log(`  → PDF Pages: [${aggregated.addendum_pages.sort((a,b) => a-b).join(", ")}]`);
  } else {
    console.log("\nAddenda: None found");
  }

  console.log(`\n📊 SUMMARY:`);
  console.log(`   Total pages analyzed: ${totalPages}`);
  console.log(`   Critical pages found: ${criticalPageNumbers.length}`);
  console.log(`   Page numbers: [${criticalPageNumbers.join(", ")}]`);
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const criticalImages = pages.filter(p => criticalPageNumbers.includes(p.pageNumber));

  return {
    state: "California",
    criticalPageNumbers,
    criticalImages,
  };
}