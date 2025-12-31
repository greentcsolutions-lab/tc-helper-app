// TC Helper App
// src/lib/extraction/router.ts
// Version: 3.0.0 - 2025-12-31
// FIXED: Updated universalExtractor call signature (removed packageMetadata parameter)

import { californiaExtractor } from './extract/california/index';
import { universalExtractor } from './extract/universal/index';

import type { LabeledCriticalImage } from '@/types/classification';
import type { UniversalExtractionResult } from '../../types/extraction';

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
  route: 'california' | 'universal' | 'california-fallback-universal';
}

/**
 * Routes classification results to the appropriate extractor
 * Does NOT run classification — only receives results and decides strategy
 */
export async function route(input: RouterInput): Promise<RouterOutput> {
  const { criticalImages, packageMetadata, highDpiPages, classificationMetadata } = input;
  const { detectedFormCodes } = packageMetadata;

  console.log('[router] Received classification results');
  console.log('[router] Detected forms:', detectedFormCodes.join(', ') || 'none');
  console.log('[router] Critical images:', criticalImages.length);

  // Map critical images to high-DPI versions
  const highResCriticalImages: LabeledCriticalImage[] = criticalImages.map((crit) => {
    const highRes = highDpiPages.find((p) => p.pageNumber === crit.pageNumber);
    if (!highRes) {
      throw new Error(`Missing high-DPI for page ${crit.pageNumber}`);
    }
    return { ...crit, base64: highRes.base64 };
  });

  console.log('[router] Mapped to high-DPI images:', highResCriticalImages.length);

  // ROUTING DECISION: Determine which extractor to use
  const californiaFormCodes = ['RPA', 'SCO', 'SMCO', 'BCO', 'ADM', 'PRBS', 'AD', 'ZIP'];
  const isCalifornia = detectedFormCodes.some((code) => californiaFormCodes.includes(code));

  // ROUTE 1: California-specific extraction (if enabled and detected)
  if (isCalifornia && highResCriticalImages.length > 0) {
    console.log('[router] Routing to California extractor');
    console.log('[router] California extractor disabled, using universal fallback');
  }

  // ROUTE 2: Universal extraction (fallback or primary)
  console.log('[router] Routing to universal extractor');
  
  // FIXED v3.0.0: universalExtractor now only takes 2 parameters:
  // 1. criticalImages (with high-DPI base64)
  // 2. classificationMetadata (contains criticalPageNumbers, pageLabels, packageMetadata)
  const universalResult = await universalExtractor(
    highResCriticalImages,
    classificationMetadata
  );

  return {
    universal: universalResult.universal,
    details: universalResult.details,
    timelineEvents: universalResult.timelineEvents,
    needsReview: universalResult.needsReview,
    route: isCalifornia ? 'california-fallback-universal' : 'universal',
  };
}