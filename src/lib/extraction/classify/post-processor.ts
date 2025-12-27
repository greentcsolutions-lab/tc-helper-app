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

// UPDATED: Priority scoring — signatures and broker_info now high priority
const CATEGORY_PRIORITY: Record<string, number> = {
  core_terms: 10,
  counter_or_addendum: 9,    // overrides are king
  contingencies: 8,
  financing_details: 7,
  signatures: 9,             // BOOSTED — acceptance, effective date, always needed
  broker_info: 9,            // NEW + BOOSTED — agency contacts critical for workflow
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

    // NEW: Always exclude disclosures and boilerplate (force score to 0)
    if (page.contentCategory === 'disclosures' || page.contentCategory === 'boilerplate') {
      score = 0;
    }

    return {
      page,
      score
    };
  });

  // Sort highest score first
  scored.sort((a, b) => b.score - a.score);

  // Always force-include any counter/addendum, signatures, or broker_info pages
  const highPriority = scored.filter(s => 
    s.page.contentCategory === 'counter_or_addendum' ||
    s.page.contentCategory === 'signatures' ||
    s.page.contentCategory === 'broker_info'
  );
  const topNonPriority = scored
    .filter(s => 
      s.page.contentCategory !== 'counter_or_addendum' &&
      s.page.contentCategory !== 'signatures' &&
      s.page.contentCategory !== 'broker_info' &&
      s.score > 0  // Exclude any forced 0 scores
    )
    .slice(0, 10); // tighter cap now that high-priority are force-included

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