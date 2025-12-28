// src/lib/extraction/classify/post-processor.ts
// Version: 2.6.0-universal-dense-legalese-demote - 2025-12-27
// ENHANCED: Stronger demotion of dense legalese pages (even in early main_contract pages)
//           Only early pages with actual filled fields qualify for the boost

import type { LabeledCriticalImage, GrokPageResult } from '../../../types/classification';

interface GrokClassifierOutput {
  pages: (GrokPageResult | null)[];
}

export function mergeDetectedPages(
  allGrokPages: (GrokPageResult | null)[]
): GrokPageResult[] {
  return allGrokPages.filter((p): p is GrokPageResult => p !== null);
}

const CATEGORY_PRIORITY: Record<string, number> = {
  core_terms: 10,
  counter_or_addendum: 9,
  contingencies: 8,
  financing_details: 7,
  signatures: 9,
  broker_info: 9,
  disclosures: 3,
  boilerplate: 1,
  other: 2,
};

export function getCriticalPageNumbers(detectedPages: GrokPageResult[]): number[] {
  const scored = detectedPages.map(page => {
    let score =
      (CATEGORY_PRIORITY[page.contentCategory || 'other'] || 0) +
      (page.hasFilledFields ? 5 : 0) +
      (page.confidence ?? 0) / 20;

    // Hard excludes
    if (page.contentCategory === 'disclosures' || page.contentCategory === 'boilerplate') {
      score = 0;
    }

    if (page.titleSnippet && /blank|intentionally left blank|this page left blank/i.test(page.titleSnippet)) {
      score = 0;
    }

    // Title-based advisory/legalese guardrail
    const looksLikeLegaleseTitle =
      page.titleSnippet &&
      /(advisory|disclosure|notice|remedies|arbitration|mediation|attorney fees|risk|warning|important)/i.test(
        page.titleSnippet
      );

    if (looksLikeLegaleseTitle) {
      score = Math.min(score, CATEGORY_PRIORITY[page.contentCategory || 'other'] || 2);
    }

    // UNIVERSAL EARLY-PAGE BOOST — NOW REQUIRES FILLED FIELDS
    // All major U.S. contracts put core terms in first ~5 pages, but last 1–2 are often legalese
    const isHighValueRole =
      page.role === 'main_contract' ||
      page.role === 'counter_offer' ||
      page.role === 'addendum' ||
      page.role === 'local_addendum';

    const formPage = page.formPage ?? null;
    if (
      isHighValueRole &&
      formPage !== null &&
      formPage <= 5 &&
      page.hasFilledFields &&               // ← CRITICAL: must have visible filled data
      !looksLikeLegaleseTitle               // ← don't boost pure advisory pages
    ) {
      score += 5; // Keep the boost strong for true core-term pages (price, financing, contingencies)
    }

    // NEW: SEVERE DEMOTION FOR DENSE LEGALESE (even in main_contract)
    // If no filled fields AND not a force-include category → treat as near-worthless
    const isForceIncludeCategory =
      page.contentCategory === 'counter_or_addendum' ||
      page.contentCategory === 'signatures' ||
      page.contentCategory === 'broker_info';

    if (!page.hasFilledFields && !isForceIncludeCategory) {
      // Cap at minimal score — effectively excludes unless very high confidence pushes it in
      score = Math.min(score, 3);
    }

    return { page, score };
  });

  scored.sort((a, b) => b.score - a.score);

  // Force-include absolute must-haves
  const highPriority = scored.filter(
    s =>
      s.page.contentCategory === 'counter_or_addendum' ||
      s.page.contentCategory === 'signatures' ||
      s.page.contentCategory === 'broker_info'
  );

  // Non-priority: require filled fields, tight cap
  const topNonPriority = scored
    .filter(
      s =>
        s.page.hasFilledFields &&
        s.page.contentCategory !== 'counter_or_addendum' &&
        s.page.contentCategory !== 'signatures' &&
        s.page.contentCategory !== 'broker_info' &&
        s.score > 0
    )
    .slice(0, 8);

  const selectedPages = Array.from(
    new Set([
      ...highPriority.map(s => s.page.pdfPage),
      ...topNonPriority.map(s => s.page.pdfPage),
    ])
  );

  return selectedPages.sort((a, b) => a - b);
}

// Rest of file unchanged (labels, images, metadata)
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

  return {
    detectedFormCodes: formCodes,
    totalDetectedPages: detectedPages.length,
    hasMultipleForms: formCodes.length > 1,
  };
}