// src/lib/extraction/extract/universal/helpers/document-priority.ts
// Version: 1.0.0 - 2025-12-31
// Document priority calculation with addendum attachment detection

import type { EnrichedPageExtraction } from '@/types/extraction';
import { getLatestSignatureDate, areDatesWithinDays } from './counter-detection';

/**
 * Base priority values for page roles
 * Lower number = processed first (baseline)
 * Higher number = processed later (override)
 */
const BASE_ROLE_PRIORITY = {
  'main_contract': 1,
  'counter_offer': 2,
  'addendum': 2,        // Default: same as counter
  'signatures': 3,
  'broker_info': 4,
} as const;

/**
 * Calculate document priority for merge pipeline ordering
 * 
 * Priority rules:
 * 1. Main contract = priority 1 (baseline)
 * 2. Counter offers = priority 2 (override)
 * 3. Addenda = priority 2 OR 2.5 (depends on attachment)
 *    - Standalone addendum = priority 2
 *    - Addendum attached to counter = priority 2.5 (counter + 0.5)
 * 4. Signatures = priority 3
 * 5. Broker info = priority 4
 * 
 * Attachment detection:
 * - Compare addendum signature date to counter signature dates
 * - If within 1 day = addendum attached to that counter
 * - Priority becomes (counter priority + 0.5)
 */
export function getDocumentPriority(
  page: EnrichedPageExtraction,
  allPages: EnrichedPageExtraction[]
): number {
  let priority = BASE_ROLE_PRIORITY[page.pageRole];
  
  // Special handling for addenda - detect if attached to a counter
  if (page.pageRole === 'addendum') {
    const addendumSigDate = getLatestSignatureDate(page);
    
    if (addendumSigDate) {
      // Find counter offers with matching/close signature dates (within 1 day)
      const matchingCounter = allPages.find(p => 
        p.pageRole === 'counter_offer' &&
        areDatesWithinDays(getLatestSignatureDate(p), addendumSigDate, 1)
      );
      
      if (matchingCounter) {
        // Addendum attached to counter = counter priority + 0.5
        priority = BASE_ROLE_PRIORITY['counter_offer'] + 0.5;
        console.log(
          `[priority] Page ${page.pageNumber} (${page.pageLabel}): ` +
          `Addendum attached to counter on page ${matchingCounter.pageNumber} ` +
          `(sig dates within 1 day) → priority ${priority}`
        );
      } else {
        console.log(
          `[priority] Page ${page.pageNumber} (${page.pageLabel}): ` +
          `Standalone addendum → priority ${priority}`
        );
      }
    }
  }
  
  return priority;
}

/**
 * Sort pages by document priority for merge pipeline
 * 
 * Sorting rules:
 * 1. Primary sort: by priority (ascending)
 * 2. Secondary sort: by signature date (ascending - oldest first)
 * 3. Tertiary sort: by page number (ascending)
 */
export function sortPagesByPriority(
  pages: EnrichedPageExtraction[],
  allPages: EnrichedPageExtraction[]
): EnrichedPageExtraction[] {
  return [...pages].sort((a, b) => {
    // Primary: priority
    const priorityA = getDocumentPriority(a, allPages);
    const priorityB = getDocumentPriority(b, allPages);
    
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    
    // Secondary: signature date (oldest first within same priority)
    const dateA = getLatestSignatureDate(a);
    const dateB = getLatestSignatureDate(b);
    
    if (dateA && dateB && dateA !== dateB) {
      return dateA.localeCompare(dateB);
    }
    
    // Tertiary: page number
    return a.pageNumber - b.pageNumber;
  });
}