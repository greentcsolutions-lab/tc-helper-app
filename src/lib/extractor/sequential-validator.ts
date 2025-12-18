// src/lib/extractor/sequential-validator.ts
// Version: 2.0.0 - 2025-01-09
// Validates RPA pages are in correct sequential order

import { RPA_FORM } from "./form-definitions";

export interface RPABlock {
  isValid: boolean;
  pages: Record<number, number>;  // RPA page → PDF page mapping
  gaps: string[];  // Warnings about missing pages
  isSequential: boolean;
}

/**
 * Validate RPA block structure
 * 
 * Expected patterns:
 * - IDEAL: Pages 1-3 consecutive, then gap, then 16-17 consecutive
 * - ACCEPTABLE: Pages found but not consecutive (e.g., scattered by counters)
 * - INVALID: Missing required pages or wrong order
 */
export function validateRPABlock(
  rpaPages: Record<number, number>  // RPA page → PDF page
): RPABlock {
  const result: RPABlock = {
    isValid: true,
    pages: rpaPages,
    gaps: [],
    isSequential: true,
  };

  // Check we have all required pages
  const requiredPages = RPA_FORM.requiredInternalPages;
  const foundPages = Object.keys(rpaPages).map(Number);
  
  for (const requiredPage of requiredPages) {
    if (!foundPages.includes(requiredPage)) {
      result.isValid = false;
      result.gaps.push(`Missing RPA Page ${requiredPage}`);
    }
  }

  if (!result.isValid) {
    console.error('[sequential-validator] ✗ RPA block INVALID:', result.gaps);
    return result;
  }

  // Check if pages are sequential
  const pdfPages = foundPages.map(rpaPage => rpaPages[rpaPage]).sort((a, b) => a - b);
  
  // Check if Pages 1-3 are consecutive
  const pages123 = [rpaPages[1], rpaPages[2], rpaPages[3]].filter(Boolean).sort((a, b) => a - b);
  const pages123Sequential = pages123.length === 3 && 
    pages123[1] === pages123[0] + 1 && 
    pages123[2] === pages123[1] + 1;

  // Check if Pages 16-17 are consecutive
  const pages1617 = [rpaPages[16], rpaPages[17]].filter(Boolean).sort((a, b) => a - b);
  const pages1617Sequential = pages1617.length === 2 && 
    pages1617[1] === pages1617[0] + 1;

  if (!pages123Sequential) {
    result.isSequential = false;
    result.gaps.push(`RPA Pages 1-3 not consecutive (found at PDF pages ${pages123.join(', ')})`);
  }

  if (!pages1617Sequential) {
    result.isSequential = false;
    result.gaps.push(`RPA Pages 16-17 not consecutive (found at PDF pages ${pages1617.join(', ')})`);
  }

  // Log results
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[sequential-validator] 📋 RPA BLOCK VALIDATION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('RPA Page Mapping:');
  requiredPages.forEach(rpaPage => {
    const pdfPage = rpaPages[rpaPage];
    console.log(`  RPA Page ${rpaPage} → PDF Page ${pdfPage || 'NOT FOUND'}`);
  });

  if (result.isSequential) {
    console.log('\n✓ Pages 1-3 are consecutive');
    console.log('✓ Pages 16-17 are consecutive');
  } else {
    console.log('\n⚠ WARNING: Non-sequential RPA pages detected');
    result.gaps.forEach(gap => console.log(`  - ${gap}`));
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  return result;
}

/**
 * Predict next RPA page based on current page
 * Used by classifier to validate sequential logic
 */
export function predictNextRPAPage(currentRPAPage: number): number | null {
  // Pages 1-3 should be followed by next page
  if (currentRPAPage >= 1 && currentRPAPage < 3) {
    return currentRPAPage + 1;
  }

  // Page 3 can have a gap before 16
  if (currentRPAPage === 3) {
    return 16;  // Expected next critical page
  }

  // Page 16 should be followed by 17
  if (currentRPAPage === 16) {
    return 17;
  }

  return null;  // No prediction available
}

/**
 * Check if PDF page could be RPA Page N based on context
 * 
 * Context clues:
 * - Page 1: Has "THIS IS AN OFFER FROM" near top
 * - Page 2: Has "FINANCING" or "LOAN TERMS" section
 * - Page 3: Has "CLOSING" or "TIMELINE" section
 * - Page 16: Has signature blocks
 * - Page 17: Has "REAL ESTATE BROKERS" section
 */
export function validatePageContext(
  rpaPageNumber: number,
  pageContent: string
): boolean {
  const content = pageContent.toLowerCase();

  switch (rpaPageNumber) {
    case 1:
      return content.includes('this is an offer from') || 
             content.includes('buyer names');
    
    case 2:
      return content.includes('financing') || 
             content.includes('loan terms') ||
             content.includes('seller payment to cover buyer expenses');
    
    case 3:
      return content.includes('items included and excluded') ||
             content.includes('closing') ||
             content.includes('possession');
    
    case 16:
      return content.includes('seller') && 
             (content.includes('signature') || content.includes('date'));
    
    case 17:
      return content.includes('real estate brokers') ||
             content.includes('broker information');
    
    default:
      return true;  // No context check for other pages
  }
}