// src/lib/extraction/classify/post-processor.ts
// Version: 2.5.0-universal-legalese-filter - 2025-12-27
// ENHANCED: Intelligent, form-agnostic filtering of text-dense legalese pages
//           No reliance on specific form structure or state-specific knowledge

import type { LabeledCriticalImage, GrokPageResult } from '../../../types/classification';

interface GrokClassifierOutput {
  pages: (GrokPageResult | null)[];
}

export function mergeDetectedPages(
  allGrokPages: (GrokPageResult | null)[]
): GrokPageResult[] {
  return allGrokPages.filter((p): p is GrokPageResult => p !== null);
}

// Category base priorities (unchanged)
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

    // Hard exclude known low-value categories
    if (page.contentCategory === 'disclosures' || page.contentCategory === 'boilerplate') {
      score = 0;
    }

    // Explicit blank page exclusion (titleSnippet check)
    if (page.titleSnippet && /blank|intentionally left blank|this page left blank/i.test(page.titleSnippet)) {
      score = 0;
    }

    // UNIVERSAL EARLY-PAGE BOOST (already proven safe across states)
    const isHighValueRole =
      page.role === 'main_contract' ||
      page.role === 'counter_offer' ||
      page.role === 'addendum' ||
      page.role === 'local_addendum';

    const formPage = page.formPage ?? null;
    if (isHighValueRole && formPage !== null && formPage <= 5 && page.hasFilledFields) {
      score += 5;
    }

    // NEW: INTELLIGENT LEGALESE FILTER
    // If Grok already tagged it as boilerplate → already score=0 above
    // Additional heuristic: downrank pages that are likely pure legalese
    // even if Grok gave them a higher category
    const looksLikeLegalese =
      // No filled fields (most reliable signal)
      !page.hasFilledFields ||
      // Title contains common advisory/legalese words
      (page.titleSnippet &&
        /(advisory|disclosure|notice|remedies|arbitration|mediation|attorney fees|risk|warning|important)/i.test(
          page.titleSnippet
        ));

    if (looksLikeLegalese) {
      // Don't completely kill it (might be a signed disclosure we need)
      // Just remove the filled-field boost and cap base score
      score = Math.min(score, CATEGORY_PRIORITY[page.contentCategory || 'other'] || 2);
    }

    return { page, score };
  });

  // Sort descending
  scored.sort((a, b) => b.score - a.score);

  // Force-include absolute must-haves
  const highPriority = scored.filter(
    s =>
      s.page.contentCategory === 'counter_or_addendum' ||
      s.page.contentCategory === 'signatures' ||
      s.page.contentCategory === 'broker_info'
  );

  // Non-priority: only filled pages, tighter cap
  const topNonPriority = scored
    .filter(
      s =>
        s.page.hasFilledFields && // ← KEY: require actual filled data
        s.page.contentCategory !== 'counter_or_addendum' &&
        s.page.contentCategory !== 'signatures' &&
        s.page.contentCategory !== 'broker_info' &&
        s.score > 0
    )
    .slice(0, 8); // Reduced from 10 → expect 12–15 total critical pages

  // Combine + dedupe + sort by PDF order
  const selectedPages = Array.from(
    new Set([
      ...highPriority.map(s => s.page.pdfPage),
      ...topNonPriority.map(s => s.page.pdfPage),
    ])
  );

  return selectedPages.sort((a, b) => a - b);
}

// Rest of file unchanged
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