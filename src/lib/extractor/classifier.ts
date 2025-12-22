// src/lib/extractor/classifier.ts
// Version: 5.3.0 - 2025-12-22
// UPDATED: Two-phase architecture - simple Grok sweep + rich post-processing
//          Schema now matches actual Grok output (simple per-page array)
//          Post-processing builds detectedForms and labels for extractor

import { buildClassifierPrompt } from "./prompts";

console.log("[classifier] XAI_API_KEY present:", !!process.env.XAI_API_KEY);

const chunk = <T>(arr: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  );

// === GROK OUTPUT (Simple per-page sweep) ===
interface GrokPageResult {
  pdfPage: number;
  formCode: 'RPA' | 'SCO' | 'SMCO' | 'BCO';
  formPage: number;
  footerText: string;
}

interface GrokClassifierOutput {
  pages: (GrokPageResult | null)[];  // null = no form footer detected
}

// === POST-PROCESSED OUTPUT (Rich structured data) ===
interface PageMapping {
  formPage: number;
  pdfPage: number;
  footerLabel?: string | null;
}

interface DetectedForm {
  formCode: 'RPA' | 'SCO' | 'SMCO' | 'BCO' | 'ADM' | 'TOA' | 'AEA';
  formName: string;
  addendumNumber: number | null;
  pageMapping: PageMapping[];
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

// === EXTRACTOR INPUT (What extraction needs) ===
export interface LabeledCriticalImage {
  pageNumber: number;
  base64: string;
  label: string;
}

/**
 * POST-PROCESSING: Transform simple per-page results into grouped DetectedForms
 * This is where state-specific logic lives (California RPA rules, etc.)
 */
function buildDetectedForms(grokPages: (GrokPageResult | null)[]): DetectedForm[] {
  const forms: DetectedForm[] = [];
  const formGroups = new Map<string, GrokPageResult[]>();

  // Group pages by form code
  grokPages.forEach(page => {
    if (!page) return;
    
    const key = page.formCode;
    if (!formGroups.has(key)) {
      formGroups.set(key, []);
    }
    formGroups.get(key)!.push(page);
  });

  // Build DetectedForm objects with addendum numbering
  formGroups.forEach((pages, formCode) => {
    // For counters (SCO/SMCO/BCO), group by sets
    if (['SCO', 'SMCO', 'BCO'].includes(formCode)) {
      const pagesPerCounter = formCode === 'BCO' ? 1 : 2;
      const sortedPages = pages.sort((a, b) => a.pdfPage - b.pdfPage);
      
      // Group into sets (e.g., SCO #1 = pages 1-2, SCO #2 = pages 3-4)
      for (let i = 0; i < sortedPages.length; i += pagesPerCounter) {
        const counterPages = sortedPages.slice(i, i + pagesPerCounter);
        const counterNumber = Math.floor(i / pagesPerCounter) + 1;
        
        forms.push({
          formCode: formCode as any,
          formName: formCode === 'SCO' ? 'SELLER COUNTER OFFER' :
                    formCode === 'SMCO' ? 'SELLER MULTIPLE COUNTER OFFER' :
                    'BUYER COUNTER OFFER',
          addendumNumber: counterNumber,
          pageMapping: counterPages.map(p => ({
            formPage: p.formPage,
            pdfPage: p.pdfPage,
            footerLabel: p.footerText,
          })),
        });
      }
    } else {
      // RPA - single form, no addendum number
      forms.push({
        formCode: formCode as any,
        formName: 'CALIFORNIA RESIDENTIAL PURCHASE AGREEMENT',
        addendumNumber: null,
        pageMapping: pages.map(p => ({
          formPage: p.formPage,
          pdfPage: p.pdfPage,
          footerLabel: p.footerText,
        })),
      });
    }
  });

  return forms;
}

/**
 * POST-PROCESSING: Build RPA blocks from detected RPA pages
 * California-specific logic: expects consecutive pages 1-2, calculates 3/16/17
 */
function buildRPABlocks(detectedForms: DetectedForm[], totalPages: number): RPABlock[] {
  const rpaBlocks: RPABlock[] = [];
  
  const rpaForm = detectedForms.find(f => f.formCode === 'RPA');
  if (!rpaForm) return rpaBlocks;

  const mapping = rpaForm.pageMapping.reduce((acc, m) => {
    acc[`page${m.formPage}`] = m.pdfPage;
    return acc;
  }, {} as Record<string, number | undefined>);

  const page1 = mapping.page1;
  const page2 = mapping.page2;

  if (page1 && page2 && page2 === page1 + 1) {
    rpaBlocks.push({
      startPage: page1,
      pages: [
        page1,
        page2,
        mapping.page3 ?? page2 + 1,
        mapping.page16 ?? page1 + 15,
        mapping.page17 ?? page1 + 16,
      ].filter(p => p <= totalPages),
      confidence: (mapping.page3 && mapping.page16 && mapping.page17) ? 'high' : 'calculated',
      detectedPages: {
        page1,
        page2,
        page3: mapping.page3 ?? null,
        page16: mapping.page16 ?? null,
        page17: mapping.page17 ?? null,
      }
    });
  }

  return rpaBlocks;
}

/**
 * POST-PROCESSING: Build rich labels for extractor
 * California-specific contextual descriptions
 */
function buildPageLabels(
  detectedForms: DetectedForm[],
  rpaBlocks: RPABlock[],
  keyExtractionPages: number[]
): Map<number, string> {
  const labelMap = new Map<number, string>();

  // RPA pages - highest quality labels
  if (rpaBlocks.length > 0) {
    const primaryBlock = rpaBlocks[0].detectedPages;
    
    if (primaryBlock.page1) {
      labelMap.set(primaryBlock.page1, "RPA PAGE 1 OF 17 (ADDRESS, PRICE, FINANCING & CLOSING)");
    }
    if (primaryBlock.page2) {
      labelMap.set(primaryBlock.page2, "RPA PAGE 2 OF 17 (CONTINGENCIES & FINANCING)");
    }
    if (primaryBlock.page3) {
      labelMap.set(primaryBlock.page3, "RPA PAGE 3 OF 17 (ITEMS INCLUDED & HOME WARRANTY)");
    }
    if (primaryBlock.page16) {
      labelMap.set(primaryBlock.page16, "RPA PAGE 16 OF 17 (BUYER & SELLER SIGNATURES)");
    }
    if (primaryBlock.page17) {
      labelMap.set(primaryBlock.page17, "RPA PAGE 17 OF 17 (BROKER INFORMATION)");
    }
  }

  // Counters & Addenda
  detectedForms.forEach(form => {
    if (form.formCode === 'RPA') return;

    form.pageMapping.forEach(mapping => {
      let label = form.formCode;
      if (form.addendumNumber) label += ` #${form.addendumNumber}`;

      const totalPages = form.formCode === 'BCO' ? 1 : 2;
      label += ` PAGE ${mapping.formPage} OF ${totalPages}`;
      label += ' (COUNTER OFFER OR ADDENDUM)';

      labelMap.set(mapping.pdfPage, label.trim());
    });
  });

  // Fallback
  keyExtractionPages.forEach(pdfPage => {
    if (!labelMap.has(pdfPage)) {
      labelMap.set(pdfPage, `KEY PAGE ${pdfPage} (TERMS OR SIGNATURES)`);
    }
  });

  return labelMap;
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

  // Build batch-specific prompt
  const batchPrompt = buildClassifierPrompt(start, end, batch.length);

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
            { type: "text", text: batchPrompt },
            ...batch.flatMap(p => [
              { type: "text", text: `\n━━━ PDF_Page_${p.pageNumber} (of ${totalPages} total) ━━━` },
              { type: "image_url", image_url: { url: p.base64 } }
            ])
          ]
        }]
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
      if (!jsonMatch) {
        console.error(`[classifier:batch${batchIndex + 1}] No JSON found`);
        return null;
      }
      json = JSON.parse(jsonMatch);

      // Simple validation
      if (!json.pages || !Array.isArray(json.pages)) {
        console.error(`[classifier:batch${batchIndex + 1}] Invalid schema - missing pages array`);
        return null;
      }

      const detectedCount = json.pages.filter(p => p !== null).length;
      console.log(`[classifier:batch${batchIndex + 1}] Parsed: ${detectedCount}/${json.pages.length} pages with form footers`);

    } catch (err) {
      console.error(`[classifier:batch${batchIndex + 1}] JSON parse failed`);
      return null;
    }

    console.log(`[classifier:batch${batchIndex + 1}] ✓ Pages ${start}–${end} classified`);
    return { batchStartPage: start, result: json };

  } catch (error: any) {
    console.error(`[classifier:batch${batchIndex + 1}] Request failed:`, error.message);
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
  rpaBlocksDetected: RPABlock[];
  primaryForm: string;
  hasCountersOrAddenda: boolean;
}> {
  if (!pages?.length) {
    throw new Error("classifyCriticalPages received invalid pages array");
  }

  const BATCH_SIZE = 15;
  const batches = chunk(pages, BATCH_SIZE);

  console.log(`[classifier] 🔍 PHASE 1: Simple form detection sweep`);
  console.log(`[classifier] Processing ${pages.length} pages → ${batches.length} batches`);

  const startTime = Date.now();

  const results = await Promise.allSettled(
    batches.map((batch, i) => classifyBatch(batch, i, batches.length, totalPages))
  );

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[classifier] ✓ Grok sweep complete in ${elapsed}s`);

  // Collect valid results with batch context
  const validResults = results
    .filter((r): r is PromiseFulfilledResult<{ batchStartPage: number; result: GrokClassifierOutput } | null> => r.status === 'fulfilled')
    .map(r => r.value)
    .filter((r): r is { batchStartPage: number; result: GrokClassifierOutput } => r !== null);

  if (validResults.length === 0) {
    throw new Error('No valid classification results from any batch');
  }

  // CRITICAL: Reconstruct full page array with proper mapping
  // This ensures array index matches original PDF page number
  const allGrokPages: (GrokPageResult | null)[] = new Array(totalPages).fill(null);
  
  validResults.forEach(({ batchStartPage, result }) => {
    result.pages.forEach((page, indexInBatch) => {
      const actualPdfPage = batchStartPage + indexInBatch;
      
      if (page !== null) {
        // Verify Grok returned correct page number
        if (page.pdfPage !== actualPdfPage) {
          console.warn(`[classifier] ⚠️ Page mapping mismatch: expected ${actualPdfPage}, Grok returned ${page.pdfPage}`);
          // Trust our calculation, not Grok's
          page.pdfPage = actualPdfPage;
        }
      }
      
      allGrokPages[actualPdfPage - 1] = page;  // Convert to 0-indexed
    });
  });

  const detectedPages = allGrokPages.filter((p): p is GrokPageResult => p !== null);
  
  console.log(`[classifier] ✓ Page mapping verified: ${detectedPages.length} forms detected across ${totalPages} pages`);

  console.log(`[classifier] Raw detection: ${detectedPages.length} pages with form footers`);

  // === POST-PROCESSING: Build rich structures ===
  console.log(`[classifier] 🏗️  PHASE 2: Post-processing (California-specific logic)`);

  const detectedForms = buildDetectedForms(allGrokPages);
  const rpaBlocks = buildRPABlocks(detectedForms, totalPages);

  // Build key extraction pages
  const keyExtractionPages = Array.from(
    new Set(detectedForms.flatMap(f => f.pageMapping.map(m => m.pdfPage)))
  ).sort((a, b) => a - b);

  // Determine primary form
  const counterForms = detectedForms.filter(f => ['SCO', 'SMCO', 'BCO'].includes(f.formCode));
  const primaryForm = counterForms.length > 0
    ? counterForms[counterForms.length - 1].formCode
    : detectedForms.find(f => f.formCode === 'RPA') ? 'RPA' : 'RPA';

  const hasCountersOrAddenda = counterForms.length > 0;

  // Build labels
  const labelMap = buildPageLabels(detectedForms, rpaBlocks, keyExtractionPages);

  // Build final labeled images
  const criticalImages: LabeledCriticalImage[] = pages
    .filter(p => keyExtractionPages.includes(p.pageNumber))
    .map(p => ({
      pageNumber: p.pageNumber,
      base64: p.base64,
      label: labelMap.get(p.pageNumber) || `PDF PAGE ${p.pageNumber}`,
    }));

  // Logging
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[classifier] 📋 FINAL CLASSIFICATION RESULTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`   State: California`);
  console.log(`   Detected Forms: ${detectedForms.length}`);
  detectedForms.forEach(f => {
    const pages = f.pageMapping.map(m => m.pdfPage).join(', ');
    console.log(`     • ${f.formCode}${f.addendumNumber ? ` #${f.addendumNumber}` : ''} (${f.pageMapping.length} pages): [${pages}]`);
  });
  console.log(`   Primary Form: ${primaryForm}`);
  console.log(`   Has Counters/Addenda: ${hasCountersOrAddenda}`);
  console.log(`   Key Extraction Pages: ${keyExtractionPages.length} → [${keyExtractionPages.join(', ')}]`);
  console.log(`   Critical Images with Labels: ${criticalImages.length}`);
  criticalImages.slice(0, 5).forEach(img => {
    console.log(`     • PDF Page ${img.pageNumber}: "${img.label}"`);
  });
  if (criticalImages.length > 5) {
    console.log(`     ... and ${criticalImages.length - 5} more`);
  }
  if (rpaBlocks.length > 1) {
    console.log(`   ⚠️ Multiple RPA blocks detected (${rpaBlocks.length}) — likely COP scenario`);
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  return {
    state: "California",
    criticalPageNumbers: keyExtractionPages,
    criticalImages,
    rpaBlocksDetected: rpaBlocks,
    primaryForm,
    hasCountersOrAddenda,
  };
}