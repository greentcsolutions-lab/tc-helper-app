// src/lib/extraction/extract/universal/helpers/counter-detection.ts
// Version: 1.0.0 - 2025-12-31
// Buyer vs Seller counter offer detection logic

import type { EnrichedPageExtraction } from '@/types/extraction';

export type CounterOrigin = 'buyer' | 'seller' | 'unknown';

/**
 * Get latest signature date from a page (buyer or seller)
 * Returns ISO date string or empty string if no signatures
 */
export function getLatestSignatureDate(page: EnrichedPageExtraction): string {
  const allDates: string[] = [
    ...(page.buyerSignatureDates || []),
    ...(page.sellerSignatureDates || []),
  ].filter(Boolean);
  
  if (allDates.length === 0) return '';
  
  // Parse dates and find latest
  // Handle various formats: "10/1/2025", "10-01-2025", "October 1, 2025"
  const parsed = allDates.map(d => {
    try {
      return new Date(d).toISOString();
    } catch {
      return '';
    }
  }).filter(Boolean);
  
  return parsed.sort().reverse()[0] || '';
}

/**
 * Detect if a counter offer originated from buyer or seller
 * 
 * Detection hierarchy:
 * 1. Explicit form codes (California: BCO, SCO, SMCO)
 * 2. Title snippet analysis
 * 3. Signature-based detection
 * 4. Context-based detection (sequence analysis)
 */
export function detectCounterOrigin(
  page: EnrichedPageExtraction,
  allPages: EnrichedPageExtraction[]
): CounterOrigin {
  
  // RULE 1: California explicit form codes (highest confidence)
  if (page.formCode === 'BCO') {
    console.log(`[counter-detection] Page ${page.pageNumber}: BCO form code → BUYER counter`);
    return 'buyer';
  }
  
  if (['SCO', 'SMCO'].includes(page.formCode)) {
    console.log(`[counter-detection] Page ${page.pageNumber}: ${page.formCode} form code → SELLER counter`);
    return 'seller';
  }
  
  // RULE 2: Title snippet detection (medium confidence)
  const title = page.pageLabel?.toLowerCase() || '';
  
  if (title.includes('buyer counter')) {
    console.log(`[counter-detection] Page ${page.pageNumber}: Title contains "buyer counter" → BUYER counter`);
    return 'buyer';
  }
  
  if (title.includes('seller counter')) {
    console.log(`[counter-detection] Page ${page.pageNumber}: Title contains "seller counter" → SELLER counter`);
    return 'seller';
  }
  
  // RULE 3: Signature-based detection (medium confidence)
  const hasBuyerSigs = page.buyerSignatureDates && page.buyerSignatureDates.length > 0;
  const hasSellerSigs = page.sellerSignatureDates && page.sellerSignatureDates.length > 0;
  
  // If only one party signed, they originated the counter
  if (hasBuyerSigs && !hasSellerSigs) {
    console.log(`[counter-detection] Page ${page.pageNumber}: Only buyer signatures → BUYER counter`);
    return 'buyer';
  }
  
  if (hasSellerSigs && !hasBuyerSigs) {
    console.log(`[counter-detection] Page ${page.pageNumber}: Only seller signatures → SELLER counter`);
    return 'seller';
  }
  
  // RULE 4: Sequence-based detection (low confidence, uses standard flow pattern)
  const counterPages = allPages.filter(p => p.pageRole === 'counter_offer');
  const mainContractPages = allPages.filter(p => p.pageRole === 'main_contract');
  
  // Standard flow: Main Offer → Seller Counter → Buyer Counter → Seller Counter 2 → ...
  if (counterPages.length === 1 && mainContractPages.length > 0) {
    console.log(`[counter-detection] Page ${page.pageNumber}: Only one counter (standard flow) → SELLER counter`);
    return 'seller';
  }
  
  if (counterPages.length === 2) {
    // Two counters: seller then buyer
    const sortedByDate = [...counterPages].sort((a, b) => {
      const aDate = getLatestSignatureDate(a);
      const bDate = getLatestSignatureDate(b);
      return aDate.localeCompare(bDate);
    });
    
    const currentIndex = sortedByDate.findIndex(p => p.pageNumber === page.pageNumber);
    const origin = currentIndex === 0 ? 'seller' : 'buyer';
    console.log(`[counter-detection] Page ${page.pageNumber}: Two counters, index ${currentIndex} → ${origin.toUpperCase()} counter`);
    return origin;
  }
  
  // RULE 5: Multiple counters - alternate based on signature date sequence
  if (counterPages.length >= 3) {
    const sortedByDate = [...counterPages].sort((a, b) => {
      const aDate = getLatestSignatureDate(a);
      const bDate = getLatestSignatureDate(b);
      return aDate.localeCompare(bDate);
    });
    
    const currentIndex = sortedByDate.findIndex(p => p.pageNumber === page.pageNumber);
    // Alternate: seller (0), buyer (1), seller (2), buyer (3)...
    const origin = currentIndex % 2 === 0 ? 'seller' : 'buyer';
    console.log(`[counter-detection] Page ${page.pageNumber}: ${counterPages.length} counters, index ${currentIndex} → ${origin.toUpperCase()} counter`);
    return origin;
  }
  
  console.log(`[counter-detection] Page ${page.pageNumber}: Unable to determine origin → UNKNOWN`);
  return 'unknown';
}

/**
 * Check if dates are within N days of each other
 * Used for detecting addenda attached to counters
 */
export function areDatesWithinDays(date1: string, date2: string, days: number): boolean {
  if (!date1 || !date2) return false;
  
  try {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffMs = Math.abs(d1.getTime() - d2.getTime());
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays <= days;
  } catch {
    return false;
  }
}