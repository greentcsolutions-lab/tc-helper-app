// src/lib/extraction/extract/universal/helpers/enrichment.ts
// Version: 1.0.0 - 2025-12-31
// Classification metadata enrichment logic

import type { PerPageExtraction, EnrichedPageExtraction } from '@/types/extraction';

export function enrichWithMetadata(
  pageExtractions: PerPageExtraction[],
  classificationMetadata: {
    criticalPageNumbers: number[];
    pageLabels: Record<number, string>;
  }
): EnrichedPageExtraction[] {
  return pageExtractions.map((extraction, index) => {
    const pageNumber = classificationMetadata.criticalPageNumbers[index];
    const pageLabel = classificationMetadata.pageLabels[pageNumber];
    
    return {
      ...extraction,
      pageNumber,
      pageLabel,
      ...parsePageMetadata(pageLabel),
    };
  });
}

function parsePageMetadata(label: string): {
  formCode: string;
  formPage: number | null;
  pageRole: EnrichedPageExtraction['pageRole'];
} {
  const formCode = label.split(' ')[0] || 'UNKNOWN';
  const formPageMatch = label.match(/PAGE (\d+)/i);
  const formPage = formPageMatch ? parseInt(formPageMatch[1], 10) : null;
  const pageRole = inferPageRole(label);
  
  return { formCode, formPage, pageRole };
}

function inferPageRole(label: string): EnrichedPageExtraction['pageRole'] {
  const lower = label.toLowerCase();
  
  if (lower.includes('counter')) return 'counter_offer';
  if (lower.includes('addendum') || lower.includes('adm') || lower.includes('fvac')) return 'addendum';
  if (lower.includes('signature') || lower.includes('acceptance')) return 'signatures';
  if (lower.includes('broker')) return 'broker_info';
  
  return 'main_contract';
}