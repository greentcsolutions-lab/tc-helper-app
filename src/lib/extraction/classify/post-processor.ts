// src/lib/extraction/classify/post-processor.ts
// Version: 2.2.0-content-category - 2025-12-24
// Enhanced: Smart critical page selection using Grok's contentCategory + hasFilledFields
//           Replaces crude blacklist with priority scoring for universal relevance

import type { 
  LabeledCriticalImage, 
  GrokPageResult, 
  GrokClassifierOutput 
} from './types';

export function mergeDetectedPages(
  allGrokPages: (GrokPageResult | null)[]
): GrokPageResult[] {
  return allGrokPages.filter((p): p is GrokPageResult => p !== null);
}

// NEW: Priority scoring based on content relevance to our 12 core fields
const CATEGORY_PRIORITY: Record<string, number> = {
  core_terms: 10,
  counter_or_addendum: 9,    // overrides are king
  contingencies: 8,
  financing_details: 7,
  signatures: 6,
  disclosures: 3,
  boilerplate: 1,
  other: 2,
};

export function getCriticalPageNumbers(detectedPages: GrokPageResult[]): number[] {
  // Score each detected page
  const scored = detectedPages.map(page => ({
    page,
    score:
      (CATEGORY_PRIORITY[page.contentCategory || 'other'] || 0) +
      (page.hasFilledFields ? 5 : 0) +   // massive boost for actual filled data
      (page.confidence ?? 0) / 20        // minor confidence tie-breaker
  }));

  // Sort highest score first
  scored.sort((a, b) => b.score - a.score);

  // Always force-include any counter/addendum pages (they override everything)
  const counters = scored.filter(s => s.page.contentCategory === 'counter_or_addendum');
  const topNonCounters = scored
    .filter(s => s.page.contentCategory !== 'counter_or_addendum')
    .slice(0, 12); // safe cap even without counters

  // Combine, dedupe, and sort by PDF order
  const selectedPages = Array.from(
    new Set([
      ...counters.map(s => s.page.pdfPage),
      ...topNonCounters.map(s => s.page.pdfPage)
    ])
  );

  return selectedPages.sort((a, b) => a - b);
}

export function buildUniversalPageLabels(
  detectedPages: GrokPageResult[],
  criticalPageNumbers: number[]
): Map<number, string> {
  const labelMap = new Map<number, string>();

  detectedPages.forEach((page) => {
    const code = page.formCode?.trim() || 'UNKNOWN';
    const formPage = page.formPage ?? '?';
    const category = page.contentCategory 
      ? page.contentCategory.toUpperCase().replace('_', ' ')
      : 'UNKNOWN';
    const filled = page.hasFilledFields ? ' (FILLED)' : '';

    labelMap.set(
      page.pdfPage,
      `${code} PAGE ${formPage} – ${category}${filled}`
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