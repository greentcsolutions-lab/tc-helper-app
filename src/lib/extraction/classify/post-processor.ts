// src/lib/extraction/classify/post-processor.ts
// Version: 2.7.0 - 2025-12-29
// FIXED: Proper main_contract page selection - includes contingencies, excludes boilerplate
// Strategy: For main_contract pages, require BOTH correct contentCategory AND hasFilledFields=true

import type { LabeledCriticalImage, GrokPageResult } from '@/types/classification';

export function mergeDetectedPages(
  allGrokPages: (GrokPageResult | null)[]
): GrokPageResult[] {
  return allGrokPages.filter((p): p is GrokPageResult => p !== null);
}

/**
 * FIXED: Selects critical pages for extraction
 * 
 * Rules:
 * 1. ALL counter_offer/addendum/local_addendum pages → always included (complete overrides)
 * 2. main_contract pages → ONLY if:
 *    - contentCategory is relevant (NOT boilerplate/disclosures/other)
 *    - hasFilledFields = true (visible data, not blank templates)
 * 3. Everything else → excluded
 */
export function getCriticalPageNumbers(detectedPages: GrokPageResult[]): number[] {
  const selected = new Set<number>();

  // Categories that contain extractable transaction data
  const EXTRACTABLE_CATEGORIES = [
    'core_terms',           // Address, price, financing
    'contingencies',        // ← THIS WAS MISSING! RPA pages 2-3
    'financing_details',    // Loan details
    'signatures',           // Final acceptance date
    'broker_info',          // Agent contact info
    'counter_or_addendum',  // Changes to terms
  ];

  // Categories to NEVER extract from (dense legal text)
  const EXCLUDED_CATEGORIES = [
    'boilerplate',          // ← Dense paragraph legalese
    'disclosures',          // Standard disclosures
    'other',                // Unknown/misc
  ];

  for (const page of detectedPages) {
    const role = page.role ?? '';
    const category = page.contentCategory ?? '';
    const hasFilled = page.hasFilledFields ?? false;

    // RULE 1: Always include counters/addenda (regardless of filled status)
    if (['counter_offer', 'addendum', 'local_addendum'].includes(role)) {
      console.log(`[post-processor] ✓ Page ${page.pdfPage}: ${role} → INCLUDED (override document)`);
      selected.add(page.pdfPage);
      continue;
    }

    // RULE 2: Main contract pages - strict filtering
    if (role === 'main_contract') {
      // Explicitly exclude boilerplate/disclosures
      if (EXCLUDED_CATEGORIES.includes(category)) {
        console.log(`[post-processor] ✗ Page ${page.pdfPage}: ${category} → EXCLUDED (boilerplate)`);
        continue;
      }

      // Require both: extractable category AND visible filled fields
      if (EXTRACTABLE_CATEGORIES.includes(category) && hasFilled) {
        console.log(`[post-processor] ✓ Page ${page.pdfPage}: ${category} + filled → INCLUDED`);
        selected.add(page.pdfPage);
      } else {
        const reason = !EXTRACTABLE_CATEGORIES.includes(category) 
          ? 'non-extractable category' 
          : 'no filled fields';
        console.log(`[post-processor] ✗ Page ${page.pdfPage}: ${category} → EXCLUDED (${reason})`);
      }
      continue;
    }

    // RULE 3: All other roles (financing, disclosure, title_page, etc.) → excluded
    console.log(`[post-processor] ✗ Page ${page.pdfPage}: ${role} → EXCLUDED (not main contract or override)`);
  }

  const sortedPages = Array.from(selected).sort((a, b) => a - b);
  
  console.log(`\n[post-processor] FINAL SELECTION: ${sortedPages.length} pages → [${sortedPages.join(', ')}]`);
  
  return sortedPages;
}

export function buildUniversalPageLabels(
  detectedPages: GrokPageResult[],
  criticalPageNumbers: number[]
): Map<number, string> {
  const labelMap = new Map<number, string>();

  detectedPages.forEach((page) => {
    const code = page.formCode?.trim() || 'UNKNOWN';
    const formPage = page.formPage ?? '?';
    const rawCategory = page.contentCategory || 'UNKNOWN';
    const categoryDisplay = rawCategory === 'broker_info'
      ? 'BROKER/AGENCY INFO'
      : rawCategory.toUpperCase().replace('_', ' ');
    const filled = page.hasFilledFields ? ' (FILLED)' : '';

    labelMap.set(
      page.pdfPage,
      `${code} PAGE ${formPage} – ${categoryDisplay}${filled}`
    );
  });

  // Defensive fallback – extremely rare with this logic
  criticalPageNumbers.forEach((pdfPage) => {
    if (!labelMap.has(pdfPage)) {
      labelMap.set(pdfPage, `PAGE ${pdfPage} – KEY CONTRACT PAGE`);
    }
  });

  return labelMap;
}

export function buildLabeledCriticalImages(
  pages: { pageNumber: number; base64: string }[],
  criticalPageNumbers: number[],
  labelMap: Map<number, string>
): LabeledCriticalImage[] {
  return pages
    .filter((p) => criticalPageNumbers.includes(p.pageNumber))
    .map((p) => ({
      pageNumber: p.pageNumber,
      base64: p.base64,
      label: labelMap.get(p.pageNumber) || `PDF PAGE ${p.pageNumber}`,
    }));
}

export function extractPackageMetadata(detectedPages: GrokPageResult[]) {
  const formCodes = Array.from(new Set(detectedPages.map((p) => p.formCode))).filter(Boolean);

  const sampleFooters = detectedPages
    .map((p) => p?.footerText)
    .filter((text): text is string => typeof text === 'string' && text.trim() !== '')
    .slice(0, 5);

  return {
    detectedFormCodes: formCodes,
    sampleFooters,
    totalDetectedPages: detectedPages.length,
    hasMultipleForms: formCodes.length > 1,
  };
}