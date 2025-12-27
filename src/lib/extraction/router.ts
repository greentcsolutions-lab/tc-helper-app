// src/lib/extraction/router.ts
// Version: 2.0.0 - 2025-12-27
// Pure routing logic: Receives classification results, decides extractor, returns extraction

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
  const { criticalImages, packageMetadata, highDpiPages } = input;
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
    
    // NOTE: California extractor currently disabled in your codebase
    // Uncomment when ready to use:
    /*
    try {
      const result = await californiaExtractor(highResCriticalImages, packageMetadata);
      console.log('[router] California extraction succeeded');
      return {
        universal: result.universal,
        details: result.details ?? null,
        timelineEvents: result.timelineEvents ?? [],
        needsReview: result.needsReview,
        route: 'california',
      };
    } catch (error: any) {
      console.error('[router] California extractor failed, falling back to universal:', error);
      // Fall through to universal
    }
    */
    
    console.log('[router] California extractor disabled, using universal fallback');
  }

  // ROUTE 2: Universal extraction (fallback or primary)
  console.log('[router] Routing to universal extractor');
  const universalResult = await universalExtractor(highResCriticalImages, packageMetadata);

  return {
    universal: universalResult.universal,
    details: universalResult.details,
    timelineEvents: universalResult.timelineEvents,
    needsReview: universalResult.needsReview,
    route: isCalifornia ? 'california-fallback-universal' : 'universal',
  };
}

// Future routes can be added here:
// - texasExtractor (TREC forms)
// - floridaExtractor (FAR/BAR forms)
// - nevadaExtractor (NV RPA)
// etc.