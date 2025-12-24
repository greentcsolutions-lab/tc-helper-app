// src/lib/extraction/classify/post-processor.ts
// Version: 2.1.0-enhanced-labels - 2025-12-24
// Enhanced: Labels now show formCode + formPage clearly

import type { LabeledCriticalImage } from './classifier';

interface GrokPageResult {
  pdfPage: number;
  formCode: string;
  formPage: number;
  footerText: string;
}

interface GrokClassifierOutput {
  pages: (GrokPageResult | null)[];
}

export function mergeDetectedPages(
  allGrokPages: (GrokPageResult | null)[]
): GrokPageResult[] {
  return allGrokPages.filter((p): p is GrokPageResult => p !== null);
}

export function getCriticalPageNumbers(detectedPages: GrokPageResult[]): number[] {
  const pages = detectedPages.map((p) => p.pdfPage);
  return Array.from(new Set(pages)).sort((a, b) => a - b);
}

export function buildUniversalPageLabels(
  detectedPages: GrokPageResult[],
  criticalPageNumbers: number[]
): Map<number, string> {
  const labelMap = new Map<number, string>();

  detectedPages.forEach((page) => {
    const code = page.formCode?.trim() || 'UNKNOWN';
    const formPage = page.formPage ?? '?';
    labelMap.set(
      page.pdfPage,
      `${code} PAGE ${formPage} – POSSIBLE KEY TERMS OR SIGNATURES`
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