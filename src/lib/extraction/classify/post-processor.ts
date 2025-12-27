// src/lib/extraction/classify/post-processor.ts
// Version: 2.3.0-broker-signatures-boost - 2025-12-24
// Enhanced: Boosted priority for signatures and broker_info (critical for agency contacts)
//           Aligns with current C.A.R. RPA 6/25 format (17-page form)

import type { LabeledCriticalImage, GrokPageResult } from '../../../types/classification';

interface GrokClassifierOutput {
  pages: (GrokPageResult | null)[];
}

export function mergeDetectedPages(
  allGrokPages: (GrokPageResult | null)[]
): GrokPageResult[] {
  return allGrokPages.filter((p): p is GrokPageResult => p !== null);
}

// UPDATED: Priority scoring — boost only critical types
const CATEGORY_PRIORITY: Record<string, number> = {
  core_terms: 10,
  counter_or_addendum: 9,
  contingencies: 8,
  financing_details: 7,
  signatures: 9,
  broker_info: 9,
  disclosures: 0,  // Force low
  boilerplate: 0,
  other: 0,
};

const EXCLUDE_TITLE_PATTERNS = [/Disclosure|Advisory|Questionnaire|Notice|Statement|Guide/i];  // Matches "Seller's Disclosure", etc.

export function getCriticalPageNumbers(detectedPages: GrokPageResult[]): number[] {
  const scored = detectedPages.map(page => {
    let score = (CATEGORY_PRIORITY[page.contentCategory || 'other'] || 0) +
                (page.hasFilledFields ? 5 : 0) +
                (page.confidence ?? 0) / 20;

    // NEW: Strict exclusion for non-critical titles (override everything)
    const isExcluded = EXCLUDE_TITLE_PATTERNS.some(pat => pat.test(page.titleSnippet || ''));
    if (isExcluded || page.role === 'disclosure' || page.contentCategory === 'boilerplate') {
      score = 0;  // Force omit, even if filled/high confidence
    }

    return { page, score };
  });

  scored.sort((a, b) => b.score - a.score);

  // UPDATED: Force-includes ONLY for critical types
  const highPriority = scored.filter(s => 
    s.page.role === 'main_contract' ||
    s.page.role === 'counter_offer' ||
    s.page.role === 'addendum' ||
    s.page.contentCategory === 'counter_or_addendum' ||
    s.page.contentCategory === 'signatures' ||
    s.page.contentCategory === 'broker_info'
  );

  // TIGHTEN: Cap non-priority at 6 (focus on essentials; avg critical <10)
  const topNonPriority = scored
    .filter(s => s.score > 0 && !highPriority.includes(s))  // Exclude zeros
    .slice(0, 6);

  // Combine, dedupe, sort by PDF order
  const selectedPages = Array.from(
    new Set([
      ...highPriority.map(s => s.page.pdfPage),
      ...topNonPriority.map(s => s.page.pdfPage)
    ])
  ).sort((a, b) => a - b);

  return selectedPages;
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

  // Fallback for any undetected critical pages (should be rare now)
  criticalPageNumbers.forEach((pdfPage) => {
    if (!labelMap.has(pdfPage)) {
      labelMap.set(pdfPage, `PAGE ${pdfPage} – POSSIBLE KEY TERMS`);
    }
  });

  return labelMap;
}

// Rest of file unchanged: buildLabeledCriticalImages, extractPackageMetadata
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