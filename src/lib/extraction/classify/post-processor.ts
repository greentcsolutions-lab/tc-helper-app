// src/lib/extraction/classify/post-processor.ts
// Version: 2.8.2 - 2025-12-29
// CHANGES:
//   - Signature pages included ONLY from main transaction flow
//   - Counter/addendum pages show accurate role-based labels (SCO, ADM, FVAC, etc.)
//   - Minor label polish

import type { LabeledCriticalImage, GrokPageResult } from '@/types/classification';

export function mergeDetectedPages(
  allGrokPages: (GrokPageResult | null)[]
): GrokPageResult[] {
  return allGrokPages.filter((p): p is GrokPageResult => p !== null);
}

export function getCriticalPageNumbers(detectedPages: GrokPageResult[]): number[] {
  const selected = new Set<number>();

  const TRANSACTION_TERMS_CATEGORIES = [
    'core_terms',
    'contingencies',
    'financing_details',
    'counter_or_addendum',
  ];

  const EXCLUDED_CATEGORIES = ['boilerplate', 'disclosures', 'other'];

  console.log('\n[post-processor] === FULL CLASSIFICATION RESULTS ===');
  detectedPages.forEach((page) => {
    console.log(`[post-processor] Page ${page.pdfPage}: ${page.formCode} ${page.formPage}/${page.totalPagesInForm} | ${page.role} | ${page.contentCategory} | filled=${page.hasFilledFields}`);
  });
  console.log('[post-processor] ======================================\n');

  // First pass: collect all counter/addendum/local_addendum pages that actually modify transaction terms
  const termModifyingOverrides = new Set<number>();

  for (const page of detectedPages) {
    const role = page.role ?? '';
    const category = page.contentCategory ?? '';
    const hasFilled = page.hasFilledFields ?? false;

    if (['counter_offer', 'addendum', 'local_addendum'].includes(role)) {
      if (!hasFilled) {
        console.log(`[post-processor] ✗ Page ${page.pdfPage}: ${role} → EXCLUDED (no filled fields)`);
        continue;
      }
      if (['disclosures', 'boilerplate'].includes(category)) {
        console.log(`[post-processor] ✗ Page ${page.pdfPage}: ${role} (${page.formCode}) → EXCLUDED (disclosure-style)`);
        continue;
      }
      console.log(`[post-processor] ✓ Page ${page.pdfPage}: ${role} (${page.formCode}) → INCLUDED (modifies terms)`);
      termModifyingOverrides.add(page.pdfPage);
      selected.add(page.pdfPage);
    }
  }

  // Second pass: main_contract pages
  for (const page of detectedPages) {
    if (page.role !== 'main_contract') continue;

    const category = page.contentCategory ?? '';
    const hasFilled = page.hasFilledFields ?? false;

    if (EXCLUDED_CATEGORIES.includes(category)) {
      console.log(`[post-processor] ✗ Page ${page.pdfPage}: ${category} → EXCLUDED (boilerplate/disclosures)`);
      continue;
    }

    // Core transaction terms
    if (TRANSACTION_TERMS_CATEGORIES.includes(category) && hasFilled) {
      console.log(`[post-processor] ✓ Page ${page.pdfPage}: ${category} + filled → INCLUDED`);
      selected.add(page.pdfPage);
      continue;
    }

    // Signatures from the main contract
    if (category === 'signatures') {
      if (hasFilled) {
        console.log(`[post-processor] ✓ Page ${page.pdfPage}: signatures + filled → INCLUDED (main contract acceptance)`);
        selected.add(page.pdfPage);
      } else {
        console.log(`[post-processor] ✗ Page ${page.pdfPage}: signatures → EXCLUDED (blank)`);
      }
      continue;
    }

    // Fallback: any other filled main_contract page that's not excluded
    if (hasFilled && !EXCLUDED_CATEGORIES.includes(category)) {
      console.log(`[post-processor] ✓ Page ${page.pdfPage}: ${category} + filled → INCLUDED (main contract fallback)`);
      selected.add(page.pdfPage);
    } else {
      console.log(`[post-processor] ✗ Page ${page.pdfPage}: ${category} → EXCLUDED (non-extractable or blank)`);
    }
  }

  // Ensure signatures on term-modifying overrides are included (rare edge case)
  for (const page of detectedPages) {
    if (
      termModifyingOverrides.has(page.pdfPage) &&
      page.contentCategory === 'signatures' &&
      page.hasFilledFields
    ) {
      console.log(`[post-processor] ✓ Page ${page.pdfPage}: signatures on override → INCLUDED`);
      selected.add(page.pdfPage);
    }
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

  // Define known short/display codes for common addenda
    const ADDENDUM_DISPLAY_CODES: Record<string, string> = {
  ADM: 'ADM',
  FVAC: 'FVAC',
  FRPA: 'FRPA',
  RPA: 'RPA',
  SCO: 'SCO',
  BCO: 'BCO',
  SMCO: 'SMCO',
  AEA: 'AEA',
} as const; // optional: makes values literal types

  detectedPages.forEach((page) => {
    const rawCode = page.formCode?.trim() || 'UNKNOWN';
    const formPage = page.formPage ?? '?';
    const role = page.role ?? '';
    const category = page.contentCategory || 'UNKNOWN';
    const filled = page.hasFilledFields ? ' (FILLED)' : '';

    // Role-based display code overrides
    let displayCode = rawCode;
    if (role === 'counter_offer') {
      displayCode = 'SCO';
    } else if (role === 'addendum' || role === 'local_addendum') {
      displayCode = ADDENDUM_DISPLAY_CODES[rawCode] ?? rawCode;
    }

    let categoryDisplay =
      category === 'broker_info'
        ? 'BROKER/AGENCY INFO'
        : category.toUpperCase().replace('_', ' ');

    if (['counter_offer', 'addendum', 'local_addendum'].includes(role)) {
      categoryDisplay = 'COUNTER OR ADDENDUM';
    }

    labelMap.set(
      page.pdfPage,
      `${displayCode} PAGE ${formPage} – ${categoryDisplay}${filled}`
    );
  });

  // Defensive fallback
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