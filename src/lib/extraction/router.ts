// src/lib/extraction/router.ts
// Version: 4.0.0 - 2026-01-05
// UPDATED: Switched to Mistral OCR extractor (reuses universal post-processor)
// REMOVED: Legacy california/universal routing logic

import { mistralExtractor } from '@/lib/extraction/mistral';

import type { LabeledCriticalImage } from '@/types/classification';
import type { UniversalExtractionResult } from '@/types/extraction';

export interface RouterInput {
  criticalImages: LabeledCriticalImage[];
  packageMetadata: {
    detectedFormCodes: string[];
    sampleFooters: string[];
    totalDetectedPages: number;
    hasMultipleForms: boolean;
  };
  highDpiPages: { pageNumber: number; base64: string }[];
  classificationMetadata: {
    criticalPageNumbers: number[];
    pageLabels: Record<number, string>;
    packageMetadata: any;
  };
}

export interface RouterOutput {
  universal: UniversalExtractionResult;
  details: Record<string, any> | null;
  timelineEvents: Array<{
    date: string;
    title: string;
    type: 'info' | 'warning' | 'critical';
    description?: string;
  }>;
  needsReview: boolean;
  route: 'mistral' | 'universal-mistral';
}

/**
 * Routes classification results to the Mistral extractor
 */
export async function route(input: RouterInput): Promise<RouterOutput> {
  const { criticalImages, highDpiPages, classificationMetadata } = input;

  console.log('[router] Received classification results');
  console.log('[router] Critical images:', criticalImages.length);

  // Map critical images to high-DPI versions (200 DPI PNGs)
  const highResCriticalImages: LabeledCriticalImage[] = criticalImages.map((crit) => {
    const highRes = highDpiPages.find((p) => p.pageNumber === crit.pageNumber);
    if (!highRes) {
      throw new Error(`Missing high-DPI for page ${crit.pageNumber}`);
    }
    return { ...crit, base64: highRes.base64 };
  });

  console.log('[router] Mapped to high-DPI images:', highResCriticalImages.length);
  console.log('[router] Routing to Mistral extractor');

  const mistralResult = await mistralExtractor(
    highResCriticalImages,
    classificationMetadata
  );

  return {
    universal: mistralResult.universal,
    details: mistralResult.details,
    timelineEvents: mistralResult.timelineEvents,
    needsReview: mistralResult.needsReview,
    route: 'mistral',
  };
}