// src/lib/extraction/router.ts
// Version: 1.1.0 - 2025-12-23 - added universal fallback
// With safe fallback: if californiaExtractor fails → universalExtractor

import { classifyCriticalPages } from './classify/classifier';
import { californiaExtractor } from './extract/california/index';
import { universalExtractor } from './extract/universal/index';

import type { LabeledCriticalImage } from './classify/classifier';
import type { UniversalExtractionResult } from './extract/universal/types';

export interface ExtractionRouteResult {
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
  metadata: Awaited<ReturnType<typeof classifyCriticalPages>>;
}

export async function routeAndExtract(
  lowDpiPages: { pageNumber: number; base64: string }[],
  highDpiPages: { pageNumber: number; base64: string }[],
  totalPages: number
): Promise<ExtractionRouteResult> {
  console.log('[router] Starting classification...');
  const classification = await classifyCriticalPages(lowDpiPages, totalPages);
  const { criticalImages, packageMetadata } = classification;
  const { detectedFormCodes } = packageMetadata;

  console.log('[router] Detected forms:', detectedFormCodes.join(', ') || 'none');

  // Map to high-DPI images
  const highResCriticalImages: LabeledCriticalImage[] = criticalImages.map((crit) => {
    const highRes = highDpiPages.find((p) => p.pageNumber === crit.pageNumber);
    if (!highRes) throw new Error(`Missing high-DPI for page ${crit.pageNumber}`);
    return { ...crit, base64: highRes.base64 };
  });

  const californiaFormCodes = ['RPA', 'SCO', 'SMCO', 'BCO', 'ADM', 'PRBS', 'AD', 'ZIP'];
  const isCalifornia = detectedFormCodes.some((code) => californiaFormCodes.includes(code));
/*
  if (isCalifornia && highResCriticalImages.length > 0) {
    console.log('[router] Attempting California extractor...');
    try {
      const result = await californiaExtractor(highResCriticalImages, packageMetadata);
      console.log('[router] California extractor succeeded');
      return {
        universal: result.universal,
        details: result.details ?? null,
        timelineEvents: result.timelineEvents ?? [],
        needsReview: result.needsReview,
        route: 'california',
        metadata: classification,
      };
    } catch (error: any) {
      console.error('[router] California extractor failed → falling back to universal', error);
      // Fall through to universal path
    }
  }
*/
  console.log('[router] California route DISABLED - forcing universal extractor');


  // Universal path (either intentional or fallback)
  console.log('[router] Running universal extractor');
  const universalResult = await universalExtractor(highResCriticalImages, packageMetadata);

  return {
    universal: universalResult.universal,
    details: universalResult.details,
    timelineEvents: universalResult.timelineEvents,
    needsReview: universalResult.needsReview,
    route: isCalifornia ? 'california-fallback-universal' : 'universal',
    metadata: classification,
  };
}