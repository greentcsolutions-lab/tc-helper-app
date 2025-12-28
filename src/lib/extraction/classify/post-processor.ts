// src/lib/extraction/classify/post-processor.ts
// Version: 2.4.0-universal-early-pages - 2025-12-27
// ENHANCED: Universal boost for early pages (≤5) of main_contract, counter_offer, or addendum
//           Keeps logic state-agnostic while ensuring core terms are captured across all major U.S. forms

import type { LabeledCriticalImage, GrokPageResult } from '../../../types/classification';

interface GrokClassifierOutput {
  pages: (GrokPageResult | null)[];
}

export function mergeDetectedPages(
  allGrokPages: (GrokPageResult | null)[]
): GrokPageResult[] {
  return allGrokPages.filter((p): p is GrokPageResult => p !== null);
}

// Priority scoring — signatures, broker_info, and overrides remain highest
const CATEGORY_PRIORITY: Record<string, number> = {
  core_terms: 10,
  counter_or_addendum: 9,    // overrides are king
  contingencies: 8,
  financing_details: 7,
  signatures: 9,             // acceptance, effective date
  broker_info: 9,            // agency contacts critical
  disclosures: 3,
  boilerplate: 1,
  other: 2,
};

export function getCriticalPageNumbers(detectedPages: GrokPageResult[]): number[] {
  // Score each detected page
  const scored = detectedPages.map(page => {
    let score =
      (CATEGORY_PRIORITY[page.contentCategory || 'other'] || 0) +
      (page.hasFilledFields ? 5 : 0) +   // massive boost for actual filled data
      (page.confidence ?? 0) / 20;       // minor confidence tie-breaker

    // Exclude disclosures and boilerplate entirely
    if (page.contentCategory === 'disclosures' || page.contentCategory === 'boilerplate') {
      score = 0;
    }

    // NEW UNIVERSAL RULE: Boost early pages (formPage ≤ 5) of high-value roles
    // All major U.S. residential contracts place defining terms in first ~5 pages
    const isHighValueRole =
      page.role === 'main_contract' ||
      page.role === 'counter_offer' ||
      page.role === 'addendum' ||
      page.role === 'local_addendum';

    const formPage = page.formPage ?? null;
    if (isHighValueRole && formPage !== null && formPage <= 5 && page.hasFilledFields) {
      score += 5; // Strong boost to ensure core terms (price, financing, contingencies) are included
    }

    return {
      page,
      score
    };
  });

  // Sort highest score first
  scored.sort((a, b) => b.score - a.score);

  // Force-include critical categories
  const highPriority = scored.filter(s => 
    s.page.contentCategory === 'counter_or_addendum' ||
    s.page.contentCategory === 'signatures' ||
    s.page.contentCategory === 'broker_info'
  );

  // Add top non-priority pages (tighter cap now that high-priority + early pages are boosted)
  const topNonPriority = scored
    .filter(s => 
      s.page.contentCategory !== 'counter_or_addendum' &&
      s.page.contentCategory !== 'signatures' &&
      s.page.contentCategory !== 'broker_info' &&
      s.score > 0
    )
    .slice(0, 10);

  // Combine, dedupe, and sort by PDF order
  const selectedPages = Array.from(
    new Set([
      ...highPriority.map(s => s.page.pdfPage),
      ...topNonPriority.map(s => s.page.pdfPage)
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
    const rawCategory = page.contentCategory || 'UNKNOWN';
    const categoryDisplay = rawCategory === 'broker_info'
      ? 'BROKER/AGENCY INFO'
      : rawCategory.toUpperCase().replace('_', ' ');
    const filled = page.hasFilledFields ? ' (FILLED)' : '';

    labelMap.set(
      page.pdfPage,
      `${code} PAGE ${formPage} – \( {categoryDisplay} \){filled}`
    );
  });

  // Fallback for any undetected critical pages
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