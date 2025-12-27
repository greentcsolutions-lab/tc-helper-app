// src/lib/cache/classification-cache.ts
// Version: 1.0.0 - 2025-12-27
// In-memory cache for classification results (ephemeral, dies on cold start)

import type { LabeledCriticalImage } from '@/types/classification';

interface ClassificationCache {
  criticalImages: LabeledCriticalImage[];
  packageMetadata: {
    detectedFormCodes: string[];
    sampleFooters: string[];
    totalDetectedPages: number;
    hasMultipleForms: boolean;
  };
  criticalPageNumbers: number[];
  state: string;
  timestamp: number;
}

// In-memory storage (survives across requests, dies on cold start)
const classificationCache = new Map<string, ClassificationCache>();

// Auto-cleanup old entries every 2 minutes
setInterval(() => {
  const cutoff = Date.now() - 120_000; // 2 minutes
  for (const [key, data] of classificationCache.entries()) {
    if (data.timestamp < cutoff) {
      console.log(`[cache:cleanup] Deleting stale classification for ${key}`);
      classificationCache.delete(key);
    }
  }
}, 30_000);

export function saveClassification(parseId: string, data: Omit<ClassificationCache, 'timestamp'>): void {
  console.log(`[cache:save] Storing classification for ${parseId}`);
  console.log(`[cache:save] Critical images: ${data.criticalImages.length}`);
  console.log(`[cache:save] Forms detected: ${data.packageMetadata.detectedFormCodes.join(', ')}`);
  
  classificationCache.set(parseId, {
    ...data,
    timestamp: Date.now(),
  });
}

export function getClassification(parseId: string): ClassificationCache | null {
  const data = classificationCache.get(parseId);
  
  if (!data) {
    console.log(`[cache:get] No classification found for ${parseId}`);
    return null;
  }

  // Check if expired (2 minutes)
  if (Date.now() - data.timestamp > 120_000) {
    console.log(`[cache:get] Classification expired for ${parseId}`);
    classificationCache.delete(parseId);
    return null;
  }

  console.log(`[cache:get] Found classification for ${parseId}`);
  console.log(`[cache:get] Critical images: ${data.criticalImages.length}`);
  return data;
}

export function deleteClassification(parseId: string): void {
  console.log(`[cache:delete] Deleting classification for ${parseId}`);
  classificationCache.delete(parseId);
}

// For debugging
export function getCacheStats(): { totalEntries: number; parseIds: string[] } {
  return {
    totalEntries: classificationCache.size,
    parseIds: Array.from(classificationCache.keys()),
  };
}