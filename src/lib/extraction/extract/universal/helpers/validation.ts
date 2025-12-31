// src/lib/extraction/extract/universal/helpers/validation.ts
// Version: 1.0.0 - 2025-12-31
// Validation logic for extractions

export function validateArrayLength(received: number, expected: number): void {
  if (received !== expected) {
    console.error(
      `[post-processor] ❌ CRITICAL: Expected ${expected} extractions, got ${received}`
    );
    throw new Error(
      `Array length mismatch: Expected ${expected} extractions, got ${received}. ` +
      `Cannot proceed with index-based matching. Extraction failed.`
    );
  }
  console.log(`[post-processor] ✅ Safety check passed: ${received} extractions`);
}

export function validateExtractedTerms(
  terms: Record<string, any>,
  log: string[]
): {
  needsReview: boolean;
  needsSecondTurn: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  console.log(`\n[validator] ${"═".repeat(60)}`);
  console.log(`[validator] VALIDATING EXTRACTED TERMS`);
  console.log(`[validator] ${"═".repeat(60)}`);
  
  // Critical field validation
  if (!terms.buyerNames || !Array.isArray(terms.buyerNames) || terms.buyerNames.length === 0) {
    warnings.push('Missing buyer names');
  }
  
  if (!terms.sellerNames || !Array.isArray(terms.sellerNames) || terms.sellerNames.length === 0) {
    warnings.push('Missing seller names');
  }
  
  if (!terms.propertyAddress || typeof terms.propertyAddress !== 'string' || terms.propertyAddress.length < 10) {
    warnings.push('Missing or invalid property address');
  }
  
  if (!terms.purchasePrice || typeof terms.purchasePrice !== 'number' || terms.purchasePrice <= 0) {
    errors.push('Missing or invalid purchase price');
  }
  
  if (!terms.effectiveDate) {
    warnings.push('No effective date (no valid signature dates found)');
  }
  
  const needsReview = errors.length > 0 || warnings.length > 0;
  const needsSecondTurn = errors.length > 0;
  
  console.log(`[validator] Errors: ${errors.length}, Warnings: ${warnings.length}`);
  console.log(`[validator] ${"═".repeat(60)}\n`);
  
  return { needsReview, needsSecondTurn, errors, warnings };
}