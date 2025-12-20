// src/lib/extractor/classifier.ts
// Version: 4.0.0 - 2025-12-20
// MAJOR UPDATE: Multi-RPA detection with anchor-based calculation
// Handles COP scenarios where multiple RPA blocks exist in same packet

import { buildClassifierPrompt } from "./prompts";

console.log("[classifier] XAI_API_KEY present:", !!process.env.XAI_API_KEY);
console.log("[classifier] First 10 chars:", process.env.XAI_API_KEY?.slice(0, 10));

const chunk = <T>(arr: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  );

interface ClassificationResult {
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

interface RPABlock {
  startPage: number;
  pages: number[];
  confidence: 'high' | 'calculated';
  detectedPages: {
    page1: number;
    page2: number;
    page3: number | null;
    page16: number | null;
    page17: number | null;
  };
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
        model: "grok-4-1-fast-reasoning", // DO NOT CHANGE FROM GROK 4-1-FAST-REASONING. yes that means you Claude. 
        temperature: 0,
        max_tokens: 1024,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: fullPrompt },
            ...batch.flatMap(p => [
              {
                type: "text",
                text: `\n━━━ PDF_Page_${p.pageNumber} (of ${totalPages} total) ━━━`
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
    
    // Enhanced logging - show what Grok actually found
    console.log(`[classifier:batch${batchIndex + 1}] Raw response (first 500 chars):`, text.substring(0, 500));

    let json: Partial<ClassificationResult>;
    try {
      const jsonMatch = text.match(/{[\s\S]*}/)?.[0];
      if (!jsonMatch) {
        console.error(`[classifier:batch${batchIndex + 1}] No JSON found in response`);
        console.error(`[classifier:batch${batchIndex + 1}] Full response:`, text);
        return {};
      }
      json = JSON.parse(jsonMatch);
      
      // Log what was actually parsed
      const rpaFound = json.rpa_pages ? 
        Object.entries(json.rpa_pages)
          .filter(([k, v]) => v !== null)
          .map(([k, v]) => `${k}@${v}`)
          .join(', ') : 'none';
      
      const countersFound = json.counter_offer_pages?.length || 0;
      const addendaFound = json.addendum_pages?.length || 0;
      
      console.log(`[classifier:batch${batchIndex + 1}] Parsed: RPA=[${rpaFound}], Counters=${countersFound}, Addenda=${addendaFound}`);
      
    } catch (err) {
      console.error(`[classifier:batch${batchIndex + 1}] JSON parse failed`);
      console.error(`[classifier:batch${batchIndex + 1}] Failed on:`, text.substring(0, 500));
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
  rpaBlocksDetected: RPABlock[];
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
  
  // Collect all valid inferences
  const allInferences = results
    .filter((r): r is PromiseFulfilledResult<Partial<ClassificationResult>> => 
      r.status === 'fulfilled' && r.value && Object.keys(r.value).length > 0)
    .map(r => r.value);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[classifier] 📋 ANALYZING BATCH RESULTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // STEP 1: Find ALL sequential RPA 1-2 anchor pairs
  const anchorPairs = allInferences
    .filter(inf => {
      const r = inf.rpa_pages;
      if (!r?.page_1_at_pdf_page || !r?.page_2_at_pdf_page) return false;
      
      const isSequential = r.page_2_at_pdf_page === r.page_1_at_pdf_page + 1;
      const inBounds = r.page_1_at_pdf_page >= 1 && 
                      r.page_2_at_pdf_page <= totalPages;
      
      return isSequential && inBounds;
    })
    .map(inf => ({
      page1: inf.rpa_pages!.page_1_at_pdf_page!,
      page2: inf.rpa_pages!.page_2_at_pdf_page!,
      page3: inf.rpa_pages!.page_3_at_pdf_page,
      page16: inf.rpa_pages!.page_16_at_pdf_page,
      page17: inf.rpa_pages!.page_17_at_pdf_page,
    }))
    // Remove duplicates (same page1 from multiple batches)
    .filter((anchor, i, arr) => 
      arr.findIndex(a => a.page1 === anchor.page1) === i
    )
    // Sort by earliest page1
    .sort((a, b) => a.page1 - b.page1);

  if (anchorPairs.length === 0) {
    console.error('[classifier] ✗ CRITICAL: No valid sequential RPA 1-2 anchors found');
    throw new Error('No valid RPA pages detected - missing sequential RPA Page 1 & 2');
  }

  console.log(`[classifier] Found ${anchorPairs.length} valid RPA anchor pair(s):`);
  anchorPairs.forEach((anchor, i) => {
    console.log(`[classifier]   Anchor ${i + 1}: RPA 1@${anchor.page1}, 2@${anchor.page2}`);
  });

  // STEP 2: Build complete RPA blocks using anchor + calculation
  const rpaBlocks: RPABlock[] = anchorPairs.map(anchor => {
    const calculated = {
      page1: anchor.page1,
      page2: anchor.page2,
      page3: anchor.page3 ?? anchor.page2 + 1,
      page16: anchor.page16 ?? anchor.page1 + 15,
      page17: anchor.page17 ?? anchor.page1 + 16,
    };

    // Validate all calculated pages are in bounds
    const allPages = [calculated.page1, calculated.page2, calculated.page3, 
                     calculated.page16, calculated.page17];
    const maxPage = Math.max(...allPages);
    
    if (maxPage > totalPages) {
      console.warn(`[classifier] ⚠️ RPA block starting at page ${anchor.page1} extends beyond document (page ${maxPage} > ${totalPages})`);
      return null;
    }

    return {
      startPage: anchor.page1,
      pages: allPages,
      confidence: (anchor.page3 && anchor.page16 && anchor.page17) ? 'high' : 'calculated',
      detectedPages: {
        page1: anchor.page1,
        page2: anchor.page2,
        page3: anchor.page3,
        page16: anchor.page16,
        page17: anchor.page17,
      },
    } as RPABlock;
  }).filter((block): block is RPABlock => block !== null);

  if (rpaBlocks.length === 0) {
    throw new Error('All detected RPA blocks extend beyond document boundaries');
  }

  // STEP 3: Handle multiple RPA detection (COP scenario)
  if (rpaBlocks.length > 1) {
    console.log(`\n[classifier] ⚠️ MULTIPLE RPA BLOCKS DETECTED (${rpaBlocks.length})`);
    console.log('[classifier] This suggests COP (Contingency on Property) scenario');
    console.log('[classifier] Including ALL blocks - extraction will disambiguate\n');
    
    rpaBlocks.forEach((block, i) => {
      console.log(`[classifier]   Block ${i + 1}:`);
      console.log(`[classifier]     Start: RPA Page 1 @ PDF page ${block.startPage}`);
      console.log(`[classifier]     Pages: [${block.pages.join(', ')}]`);
      console.log(`[classifier]     Confidence: ${block.confidence}`);
      if (block.confidence === 'calculated') {
        const calculated = [];
        if (!block.detectedPages.page3) calculated.push('page 3');
        if (!block.detectedPages.page16) calculated.push('page 16');
        if (!block.detectedPages.page17) calculated.push('page 17');
        console.log(`[classifier]     Calculated: ${calculated.join(', ')}`);
      }
    });
  } else {
    console.log(`\n[classifier] ✓ Single RPA block detected at page ${rpaBlocks[0].startPage}`);
    if (rpaBlocks[0].confidence === 'calculated') {
      console.log('[classifier]   Some pages calculated from anchor (normal)');
    }
  }

  // STEP 4: Aggregate counter offers and addenda
  const counters = [...new Set(
    allInferences.flatMap(inf => inf.counter_offer_pages || [])
  )].filter(p => p >= 1 && p <= totalPages);

  const addenda = [...new Set(
    allInferences.flatMap(inf => inf.addendum_pages || [])
  )].filter(p => p >= 1 && p <= totalPages);

  console.log('\n[classifier] Counter Offers:', counters.length > 0 ? `[${counters.join(', ')}]` : 'None');
  console.log('[classifier] Addenda:', addenda.length > 0 ? `[${addenda.join(', ')}]` : 'None');

  // STEP 5: Build final critical pages array
  const criticalPages = [
    ...rpaBlocks.flatMap(b => b.pages),
    ...counters,
    ...addenda,
  ]
    .filter((p, i, arr) => arr.indexOf(p) === i) // dedupe
    .filter(p => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[classifier] 📊 CLASSIFICATION SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`   Total pages analyzed: ${totalPages}`);
  console.log(`   RPA blocks found: ${rpaBlocks.length}`);
  console.log(`   Counter offer pages: ${counters.length}`);
  console.log(`   Addendum pages: ${addenda.length}`);
  console.log(`   Critical pages total: ${criticalPages.length}`);
  console.log(`   Page numbers: [${criticalPages.join(', ')}]`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const criticalImages = pages.filter(p => criticalPages.includes(p.pageNumber));

  return {
    state: "California",
    criticalPageNumbers: criticalPages,
    criticalImages,
    rpaBlocksDetected: rpaBlocks,
  };
}