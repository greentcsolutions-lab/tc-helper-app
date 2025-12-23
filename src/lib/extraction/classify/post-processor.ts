// src/lib/extraction/classify/post-processor.ts
// Version: 2.0.0 - 2025-12-23
// Universal post-processor: no state-specific assumptions
// Merges batch data, identifies any form-footer pages as critical, builds generic labels

import type { LabeledCriticalImage } from './classifier';

interface GrokPageResult {
  pdfPage: number;
  formCode: string;        // e.g., "RPA", "SCO", "TREC", "FARBAR", or any string
  formPage: number;
  footerText: string;
}

interface GrokClassifierOutput {
  pages: (GrokPageResult | null)[];
}

/**
 * Merge all batch results into a single flat array of detected form pages
 * Keeps original Grok output intact — no assumptions about form codes
 */
export function mergeDetectedPages(
  allGrokPages: (GrokPageResult | null)[]
): GrokPageResult[] {
  return allGrokPages.filter((p): p is GrokPageResult => p !== null);
}

/**
 * Identify critical pages for universal extraction
 * Strategy: Any page with a detected form footer is potentially critical
 * (main agreement, counters, addenda, disclosures all have footers)
 */
export function getCriticalPageNumbers(detectedPages: GrokPageResult[]): number[] {
  const pages = detectedPages.map((p) => p.pdfPage);
  return Array.from(new Set(pages)).sort((a, b) => a - b);
}

/**
 * Build generic, safe labels for the universal extractor prompt
 * Avoids state-specific phrasing — works nationwide
 */
export function buildUniversalPageLabels(
  detectedPages: GrokPageResult[],
  criticalPageNumbers: number[]
): Map<number, string> {
  const labelMap = new Map<number, string>();

  detectedPages.forEach((page) => {
    const code = page.formCode || 'FORM';
    const formPage = page.formPage || '?';
    labelMap.set(
      page.pdfPage,
      `${code} PAGE ${formPage} – POSSIBLE KEY TERMS OR SIGNATURES`
    );
  });

  // Fallback for any critical pages Grok didn't label (shouldn't happen, but safe)
  criticalPageNumbers.forEach((pdfPage) => {
    if (!labelMap.has(pdfPage)) {
      labelMap.set(pdfPage, `KEY PAGE ${pdfPage} – TERMS, SIGNATURES OR ADDENDUM`);
    }
  });

  return labelMap;
}

/**
 * Final assembly: labeled critical images ready for universal extraction
 */
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

/**
 * Optional: Extract basic package metadata for routing/logging
 */
export function extractPackageMetadata(detectedPages: GrokPageResult[]) {
  const formCodes = Array.from(new Set(detectedPages.map((p) => p.formCode)));
  const footerSamples = detectedPages.slice(0, 5).map((p) => p.footerText);

  return {
    detectedFormCodes: formCodes,
    sampleFooters: footerSamples,
    totalDetectedPages: detectedPages.length,
    hasMultipleForms: formCodes.length > 1,
  };
}