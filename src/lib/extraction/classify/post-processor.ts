// src/lib/extraction/classify/post-processor.ts
// Version: 2.6.0-main-contract-refined - 2025-12-29
// Precise universal selection:
//   • ALL counter_offer / addendum / local_addendum pages → fully included (overrides must be complete)
//   • main_contract pages → ONLY those with contentCategory = core_terms, signatures, or broker_info
//   • Everything else (disclosures, lender docs, contingencies outside contract, boilerplate) → excluded

import type { LabeledCriticalImage, GrokPageResult } from '@/types/classification';

export function mergeDetectedPages(
  allGrokPages: (GrokPageResult | null)[]
): GrokPageResult[] {
  return allGrokPages.filter((p): p is GrokPageResult => p !== null);
}

/**
 * REFINED SELECTION LOGIC
 * Guarantees clean, minimal critical batch:
 *   - Full overrides (counters/addenda)
 *   - Only the truly essential main contract pages (core terms, signatures, broker info)
 */
export function getCriticalPageNumbers(detectedPages: GrokPageResult[]): number[] {
  const selected = new Set<number>();

  for (const page of detectedPages) {
    // Safe check – guard against any unexpected undefined/null role
    const role = page.role ?? '';

    // 1. Force-include every page that is a counter, addendum, or local addendum
    if (['counter_offer', 'addendum', 'local_addendum'].includes(role)) {
      selected.add(page.pdfPage);
      continue;
    }

    // 2. For main_contract pages → restrict to only the categories we care about
    if (role === 'main_contract') {
      const category = page.contentCategory ?? '';
      if (['core_terms', 'signatures', 'broker_info'].includes(category)) {
        selected.add(page.pdfPage);
      }
    }

    // All other roles (disclosure, financing, other, etc.) → ignored
  }

  // Sorted by PDF order for consistent extraction
  return Array.from(selected).sort((a, b) => a - b);
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