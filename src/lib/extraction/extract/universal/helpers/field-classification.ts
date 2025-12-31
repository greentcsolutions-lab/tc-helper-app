// src/lib/extraction/extract/universal/helpers/field-classification.ts
// Version: 1.0.0 - 2025-12-31
// Field classification for override rules in post-processing

/**
 * BUYER-ORIGINATED FIELDS
 * Rule: Highest (latest) buyer-originated counter wins > Main Contract
 * Only buyer counter offers (BCO) can override these fields
 */
export const BUYER_ORIGINATED_FIELDS = [
  'buyerNames',
] as const;

/**
 * SELLER-ORIGINATED FIELDS
 * Rule: Highest (latest) seller-originated counter wins > Main Contract
 * Only seller counter offers (SCO, SMCO) can override these fields
 */
export const SELLER_ORIGINATED_FIELDS = [
  'sellerNames',
] as const;

/**
 * NEGOTIABLE FIELDS
 * Rule: Latest signed document wins (Counters = Addenda priority, both > Main Contract)
 * Merge Strategy: DEEP MERGE for nested objects (preserve unchanged nested fields)
 */
export const NEGOTIABLE_FIELDS = [
  // Financial terms
  'purchasePrice',
  'earnestMoneyDeposit',
  'financing',
  'closingCosts',
  
  // Timeline terms
  'closingDate',
  'effectiveDate',
  'contingencies',
  
  // Property terms
  'personalPropertyIncluded',
] as const;

/**
 * INFORMATIONAL FIELDS
 * Rule: First non-null wins, BUT explicit changes in counters override
 * Special handling for address normalization, broker info merging, escrow changes
 */
export const INFORMATIONAL_FIELDS = [
  'propertyAddress',
  'brokers',
  'escrowHolder',
] as const;

/**
 * Check if a value is a nested object (not null, not array)
 */
export function isNestedObject(value: any): boolean {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Deep merge two objects (preserves unchanged nested fields)
 * 
 * Example:
 * base = { contingencies: { inspectionDays: 17, appraisalDays: 17, loanDays: 21 } }
 * override = { contingencies: { inspectionDays: 10 } }
 * result = { contingencies: { inspectionDays: 10, appraisalDays: 17, loanDays: 21 } }
 */
export function deepMerge(base: any, override: any): any {
  if (!isNestedObject(base) || !isNestedObject(override)) {
    return override;
  }
  
  const result = { ...base };
  
  for (const [key, value] of Object.entries(override)) {
    if (value === null || value === undefined) {
      // Don't override with null/undefined
      continue;
    }
    
    if (isNestedObject(value) && isNestedObject(result[key])) {
      // Recursively merge nested objects
      result[key] = deepMerge(result[key], value);
    } else {
      // Replace with override value
      result[key] = value;
    }
  }
  
  return result;
}

/**
 * Type guard to check if field is buyer-originated
 */
export function isBuyerOriginatedField(field: string): boolean {
  return BUYER_ORIGINATED_FIELDS.includes(field as any);
}

/**
 * Type guard to check if field is seller-originated
 */
export function isSellerOriginatedField(field: string): boolean {
  return SELLER_ORIGINATED_FIELDS.includes(field as any);
}

/**
 * Type guard to check if field is negotiable
 */
export function isNegotiableField(field: string): boolean {
  return NEGOTIABLE_FIELDS.includes(field as any);
}

/**
 * Type guard to check if field is informational
 */
export function isInformationalField(field: string): boolean {
  return INFORMATIONAL_FIELDS.includes(field as any);
}