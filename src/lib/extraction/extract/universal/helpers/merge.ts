// src/lib/extraction/extract/universal/helpers/merge.ts
// Version: 1.0.0 - 2025-12-31
// Page merging and override logic

import type { EnrichedPageExtraction } from '@/types/extraction';
import { isEmpty } from '@/lib/grok/type-coercion';

const METADATA_FIELDS = ['pageNumber', 'pageLabel', 'formCode', 'formPage', 'pageRole', 'confidence'] as const;

export function stripMetadata(pageData: Record<string, any>): void {
  METADATA_FIELDS.forEach(field => delete pageData[field]);
}

export function mergePages(
  pages: EnrichedPageExtraction[],
  source: string,
  provenance: Record<string, number>,
  log: string[]
): Record<string, any> {
  const merged: Record<string, any> = {};
  
  for (const page of pages) {
    const pageData: Record<string, any> = { ...page };
    stripMetadata(pageData);
    
    for (const [key, value] of Object.entries(pageData)) {
      if (value == null || isEmpty(value)) continue;
      
      if (merged[key] == null) {
        merged[key] = value;
        provenance[key] = page.pageNumber;
        log.push(`✓ ${key} from ${source} page ${page.pageNumber}`);
      } else if (page.pageNumber > provenance[key]) {
        log.push(`↻ ${key} updated from ${source} page ${page.pageNumber} (was page ${provenance[key]})`);
        merged[key] = value;
        provenance[key] = page.pageNumber;
      }
    }
  }
  
  return merged;
}

export function applyOverrides(
  baseline: Record<string, any>,
  overridePages: EnrichedPageExtraction[],
  source: string,
  provenance: Record<string, number>,
  log: string[]
): Record<string, any> {
  const result = { ...baseline };
  
  for (const page of overridePages) {
    const pageData: Record<string, any> = { ...page };
    stripMetadata(pageData);
    
    for (const [key, value] of Object.entries(pageData)) {
      if (value == null || isEmpty(value)) continue;
      
      const hadPrevious = result[key] != null;
      result[key] = value;
      provenance[key] = page.pageNumber;
      
      log.push(hadPrevious 
        ? `⚠️ ${key} OVERRIDDEN by ${source} page ${page.pageNumber}`
        : `✓ ${key} from ${source} page ${page.pageNumber}`
      );
    }
  }
  
  return result;
}