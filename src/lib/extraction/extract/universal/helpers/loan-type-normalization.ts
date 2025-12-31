// src/lib/extraction/extract/universal/helpers/loan-type-normalization.ts
// Version: 1.0.0 - 2025-12-31
// Loan type normalization for universal extraction

/**
 * Normalize loan type values to match schema enum
 * 
 * Schema enum: "Conventional" | "FHA" | "VA" | "USDA" | "Other" | null
 * 
 * Rules:
 * - Exact matches: return capitalized version
 * - Combined types (FHA/VA, FHA/USDA): return "Other"
 * - Seller financing: return "Other"
 * - Unknown/unrecognized: return "Other"
 * - Null/empty: return null
 */
export function normalizeLoanType(rawLoanType: string | null | undefined): string | null {
  if (!rawLoanType) return null;
  
  const normalized = rawLoanType.trim().toUpperCase();
  
  // Empty string
  if (normalized === '') return null;
  
  // Exact matches
  if (normalized === 'CONVENTIONAL') return 'Conventional';
  if (normalized === 'FHA') return 'FHA';
  if (normalized === 'VA') return 'VA';
  if (normalized === 'USDA') return 'USDA';
  if (normalized === 'OTHER') return 'Other';
  
  // Combined types (FHA/VA, FHA/USDA, VA/FHA, etc.) → "Other"
  if (normalized.includes('/') || normalized.includes(' OR ')) {
    console.log(`[loan-type] Combined loan type detected: "${rawLoanType}" → "Other"`);
    return 'Other';
  }
  
  // Seller financing variants
  if ((normalized.includes('SELLER') && normalized.includes('FINANC')) ||
      normalized.includes('OWNER FINANC')) {
    console.log(`[loan-type] Seller financing detected: "${rawLoanType}" → "Other"`);
    return 'Other';
  }
  
  // Common misspellings
  if (normalized.includes('CONVENTIAL') || normalized.includes('CONVENTONAL')) {
    return 'Conventional';
  }
  
  // Partial matches
  if (normalized.includes('CONVENTIONAL')) return 'Conventional';
  if (normalized.includes('FHA')) return 'FHA';
  if (normalized.includes('VA')) return 'VA';
  if (normalized.includes('USDA')) return 'USDA';
  
  // Unknown → Other
  console.log(`[loan-type] Unrecognized loan type: "${rawLoanType}" → "Other"`);
  return 'Other';
}