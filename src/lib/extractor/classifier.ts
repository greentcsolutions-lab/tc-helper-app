// src/lib/extractor/classifier.ts
// Version: 5.0.2 - 2025-12-22
// FIX: RPA block assembly now correctly merges page mappings across batches
//      Handles cases where Page 1/2 in one batch, Page 16/17 in another

import { buildClassifierPrompt } from "./prompts";

console.log("[classifier] XAI_API_KEY present:", !!process.env.XAI_API_KEY);

const chunk = <T>(arr: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  );

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

interface ClassificationResult {
  state: 'CA';
  detectedForms: DetectedForm[];
  keyExtractionPages: number[];
  primaryForm: 'RPA' | 'SCO' | 'SMCO' | 'BCO';
  hasCountersOrAddenda: boolean;
  keyIndicatorsFound?: string[];
  notes?: string | null;
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
): Promise<Partial<ClassificationResult> | null> {
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

    console.log(`[classifier:batch${batchIndex + 1}] Raw response (first 500 chars):`, text.substring(0, 500));

    let json: Partial<ClassificationResult>;
    try {
      const jsonMatch = text.match(/{[\s\S]*}/)?.[0];
      if (!jsonMatch) {
        console.error(`[classifier:batch${batchIndex + 1}] No JSON found`);
        return null;
      }
      json = JSON.parse(jsonMatch);

      const formsFound = json.detectedForms?.length || 0;
      const pagesFound = json.keyExtractionPages?.length || 0;
      console.log(`[classifier:batch${batchIndex + 1}] Parsed: ${formsFound} forms, ${pagesFound} key pages`);

    } catch (err) {
      console.error(`[classifier:batch${batchIndex + 1}] JSON parse failed`);
      return null;
    }

    console.log(`[classifier:batch${batchIndex + 1}] ✓ Pages ${start}–${end} classified`);
    return json;

  } catch (error: any) {
    console.error(`[classifier:batch${batchIndex + 1}] Request failed:`, error.message);
    return null;
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
  primaryForm: string;
  hasCountersOrAddenda: boolean;
}> {
  if (!pages?.length) {
    throw new Error("classifyCriticalPages received invalid pages array");
  }

  const BATCH_SIZE = 15;
  const batches = chunk(pages, BATCH_SIZE);
  const fullPrompt = buildClassifierPrompt(totalPages);

  console.log(`[classifier] Starting classification: ${pages.length} pages → ${batches.length} batches`);
  console.log(`[classifier] Using new rich schema with detectedForms and pageMapping`);

  const startTime = Date.now();

  const results = await Promise.allSettled(
    batches.map((batch, i) => classifyBatch(batch, i, batches.length, totalPages, fullPrompt))
  );

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[classifier] ✓ All batches complete in ${elapsed}s`);

  // Collect valid results
  const validResults = results
    .filter((r): r is PromiseFulfilledResult<Partial<ClassificationResult> | null> => r.status === 'fulfilled')
    .map(r => r.value)
    .filter((r): r is ClassificationResult => r !== null && r.detectedForms && r.keyExtractionPages);

  if (validResults.length === 0) {
    throw new Error('No valid classification results from any batch');
  }

  // Merge all detected forms across batches
  const allDetectedForms: DetectedForm[] = [];
  const seenMappings = new Set<string>();

  validResults.forEach(result => {
    result.detectedForms!.forEach(form => {
      form.pageMapping.forEach(mapping => {
        const key = `${form.formCode}-${mapping.pdfPage}`;
        if (!seenMappings.has(key)) {
          seenMappings.add(key);
          // Find or create form entry
          let existing = allDetectedForms.find(f => f.formCode === form.formCode && f.addendumNumber === form.addendumNumber);
          if (!existing) {
            existing = {
              formCode: form.formCode,
              formName: form.formName,
              addendumNumber: form.addendumNumber,
              pageMapping: []
            };
            allDetectedForms.push(existing);
          }
          existing.pageMapping.push(mapping);
        }
      });
    });
  });

  // Sort pageMapping within each form
  allDetectedForms.forEach(form => {
    form.pageMapping.sort((a, b) => a.pdfPage - b.pdfPage);
  });

  // Build final keyExtractionPages
  const allKeyPages = new Set<number>();
  validResults.forEach(r => r.keyExtractionPages.forEach(p => allKeyPages.add(p)));
  allDetectedForms.forEach(f => f.pageMapping.forEach(m => allKeyPages.add(m.pdfPage)));
  const keyExtractionPages = Array.from(allKeyPages).sort((a, b) => a - b);

  // Determine primary form
  const counterForms = allDetectedForms.filter(f => ['SCO', 'SMCO', 'BCO'].includes(f.formCode));
  const primaryForm = counterForms.length > 0
    ? counterForms[counterForms.length - 1].formCode as 'SCO' | 'SMCO' | 'BCO'
    : allDetectedForms.find(f => f.formCode === 'RPA') ? 'RPA' : 'RPA';

  // Fixed: safe boolean with fallback in case allDetectedForms is empty
  const hasCountersOrAddenda: boolean = allDetectedForms.some(f =>
    ['SCO', 'SMCO', 'BCO', 'ADM', 'TOA', 'AEA'].includes(f.formCode)
  );

  // === FIXED RPA BLOCK ASSEMBLY START ===
  const rpaBlocks: RPABlock[] = [];

  // Collect ALL RPA page mappings into one master list (same document = same RPA)
  const allRpaMappings = allDetectedForms
    .filter(f => f.formCode === 'RPA')
    .flatMap(f => f.pageMapping);

  if (allRpaMappings.length > 0) {
    // Build mapping: formPage → pdfPage
    const mapping = allRpaMappings.reduce((acc, m) => {
      acc[`page${m.formPage}`] = m.pdfPage;
      return acc;
    }, {} as Record<string, number | undefined>);

    // Find valid consecutive Page 1 and Page 2 (may appear in any order across batches)
    const page1 = mapping.page1;
    const page2 = mapping.page2;

    if (page1 && page2 && page2 === page1 + 1) {
      // Valid anchor found — build the block
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
    } else {
      console.warn(`[classifier] No valid consecutive RPA Page 1→2 found (page1: ${page1}, page2: ${page2})`);
    }

    // Future: support multiple distinct RPA blocks (COP) by grouping by startPage clusters
    // Not needed yet — current docs have only one RPA
  }
  // === FIXED RPA BLOCK ASSEMBLY END ===

  // Logging (unchanged)
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[classifier] 📋 FINAL CLASSIFICATION RESULTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`   Detected Forms: ${allDetectedForms.length}`);
  allDetectedForms.forEach(f => {
    const pages = f.pageMapping.map(m => m.pdfPage).join(', ');
    console.log(`     • ${f.formCode} (${f.pageMapping.length} pages): [${pages}]`);
  });
  console.log(`   Primary Form: ${primaryForm}`);
  console.log(`   Has Counters/Addenda: ${hasCountersOrAddenda}`);
  console.log(`   Key Extraction Pages: ${keyExtractionPages.length} → [${keyExtractionPages.join(', ')}]`);
  if (rpaBlocks.length > 1) {
    console.log(`   ⚠️ Multiple RPA blocks detected (${rpaBlocks.length}) — likely COP scenario`);
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const criticalImages = pages.filter(p => keyExtractionPages.includes(p.pageNumber));

  return {
    state: "California",
    criticalPageNumbers: keyExtractionPages,
    criticalImages,
    rpaBlocksDetected: rpaBlocks,
    primaryForm,
    hasCountersOrAddenda,
  };
}