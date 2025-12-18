// src/lib/extractor/counter-merger.ts
// Version: 2.0.0 - 2025-01-09
// Signature-aware counter offer merge logic

export interface CounterOffer {
  type: 'SCO' | 'BCO' | 'SMCO';
  number: number;  // Counter number (1, 2, 3, etc.)
  pdfPages: number[];  // Which PDF pages this counter appears on
  hasSellerSignature: boolean;
  hasBuyerSignature: boolean;
  sellerSignatureDate?: string;
  buyerSignatureDate?: string;
  modifiedFields: Record<string, any>;  // Only fields this counter changes
}

export interface MergeResult {
  finalTerms: Record<string, any>;
  finalAcceptanceDate: string;
  counterChain: string[];  // e.g., ["RPA", "SCO #1", "BCO #1"]
  isValid: boolean;
  invalidReason?: string;
}

/**
 * Determine final acceptance date based on signature rules:
 * - Buyer-originated doc (RPA, BCO) → Seller's signature date is acceptance
 * - Seller-originated doc (SCO, SMCO) → Buyer's signature date is acceptance
 */
export function getFinalAcceptanceDate(
  rpa: { buyerSignatureDate?: string; sellerSignatureDate?: string },
  counters: CounterOffer[]
): { date: string; source: string } {
  // Get the last VALID counter (both signatures present)
  const validCounters = counters.filter(c => c.hasBuyerSignature && c.hasSellerSignature);
  
  if (validCounters.length === 0) {
    // No counters or invalid counters → use RPA
    const acceptanceDate = rpa.sellerSignatureDate || rpa.buyerSignatureDate || '';
    return { date: acceptanceDate, source: 'RPA' };
  }

  // Sort by counter number descending (highest number wins)
  validCounters.sort((a, b) => b.number - a.number);
  const finalCounter = validCounters[0];

  // Determine acceptance date based on counter type
  let acceptanceDate: string;
  if (finalCounter.type === 'BCO') {
    // Buyer-originated → Seller's signature is acceptance
    acceptanceDate = finalCounter.sellerSignatureDate || '';
  } else {
    // Seller-originated (SCO, SMCO) → Buyer's signature is acceptance
    acceptanceDate = finalCounter.buyerSignatureDate || '';
  }

  return {
    date: acceptanceDate,
    source: `${finalCounter.type} #${finalCounter.number}`,
  };
}

/**
 * Merge RPA + counter offers into final terms
 * 
 * Rules:
 * 1. Highest counter number wins IF both signatures present
 * 2. Counters only replace SPECIFIC fields they mention
 * 3. If counter missing signature → ignore it
 * 4. BCO 3 > SCO 2 > BCO 2 > SCO 1 > RPA
 */
export function mergeCounterOffers(
  rpaTerms: Record<string, any>,
  rpaSignatures: { buyerSignatureDate?: string; sellerSignatureDate?: string },
  counters: CounterOffer[]
): MergeResult {
  // Start with RPA as base
  const finalTerms = { ...rpaTerms };
  const counterChain = ['RPA'];

  // Filter to only valid counters (both signatures present)
  const validCounters = counters.filter(c => {
    if (!c.hasBuyerSignature || !c.hasSellerSignature) {
      console.log(`[counter-merger] ✗ ${c.type} #${c.number} invalid - missing signatures`);
      return false;
    }
    return true;
  });

  if (validCounters.length === 0) {
    console.log('[counter-merger] No valid counters found - using RPA terms only');
    
    const { date, source } = getFinalAcceptanceDate(rpaSignatures, []);
    
    return {
      finalTerms,
      finalAcceptanceDate: date,
      counterChain,
      isValid: true,
    };
  }

  // Sort counters by number ascending (so we apply them in order: 1, 2, 3)
  validCounters.sort((a, b) => a.number - b.number);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[counter-merger] 📋 MERGING COUNTER OFFERS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Apply each counter in sequence
  for (const counter of validCounters) {
    console.log(`[counter-merger] Applying ${counter.type} #${counter.number}:`);
    
    // Merge modified fields
    for (const [field, value] of Object.entries(counter.modifiedFields)) {
      const oldValue = finalTerms[field];
      finalTerms[field] = value;
      
      console.log(`  ${field}: ${JSON.stringify(oldValue)} → ${JSON.stringify(value)}`);
    }
    
    counterChain.push(`${counter.type} #${counter.number}`);
  }

  // Get final acceptance date
  const { date: finalAcceptanceDate, source: acceptanceSource } = getFinalAcceptanceDate(
    rpaSignatures,
    validCounters
  );

  console.log(`\n[counter-merger] ✓ Final acceptance: ${finalAcceptanceDate} (from ${acceptanceSource})`);
  console.log(`[counter-merger] ✓ Counter chain: ${counterChain.join(' → ')}`);
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  return {
    finalTerms,
    finalAcceptanceDate,
    counterChain,
    isValid: true,
  };
}

/**
 * Validate counter offer structure
 * - SCO/SMCO must have 2 pages each
 * - BCO must have 1 page
 * - Signatures must be on correct pages
 */
export function validateCounterStructure(counter: CounterOffer): boolean {
  const expectedPages = counter.type === 'BCO' ? 1 : 2;
  
  if (counter.pdfPages.length !== expectedPages) {
    console.warn(`[counter-merger] ⚠ ${counter.type} #${counter.number} has ${counter.pdfPages.length} pages, expected ${expectedPages}`);
    return false;
  }

  return true;
}

/**
 * Extract counter number from form text
 * Example: "SELLER COUNTER OFFER NO. 2" → 2
 */
export function extractCounterNumber(text: string): number {
  const match = text.match(/(?:NO\.|#)\s*(\d+)/i);
  return match ? parseInt(match[1]) : 1;  // Default to 1 if not found
}