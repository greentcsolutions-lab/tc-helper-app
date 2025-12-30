// src/lib/grok/type-coercion.ts
// Version: 1.0.0 - 2025-12-30
// Type coercion utilities for handling Grok's inconsistent output types
// Independent module - can be used by any route that processes Grok responses

// ============================================================================
// PRIMITIVE TYPE COERCION
// ============================================================================

/**
 * Coerces a value to a number or returns fallback
 * Handles: string numbers ("500000"), actual numbers, null/undefined, dollar amounts
 * 
 * @example
 * coerceNumber("500000") → 500000
 * coerceNumber("$500,000") → 500000
 * coerceNumber(500000) → 500000
 * coerceNumber(null) → null
 * coerceNumber("invalid") → null
 */
export function coerceNumber(val: any, fallback: number | null = null): number | null {
  if (val == null) return fallback;
  
  // Already a number
  if (typeof val === 'number') {
    return isNaN(val) ? fallback : val;
  }
  
  // String number - remove dollar signs, commas, spaces
  if (typeof val === 'string') {
    const cleaned = val.replace(/[$,\s]/g, '').trim();
    if (cleaned === '') return fallback;
    
    const num = Number(cleaned);
    return isNaN(num) ? fallback : num;
  }
  
  return fallback;
}

/**
 * Coerces a value to a string array
 * Handles: single strings, arrays, comma-separated, null/undefined, mixed types
 * 
 * @example
 * coerceStringArray("John Doe") → ["John Doe"]
 * coerceStringArray("John, Jane") → ["John", "Jane"]
 * coerceStringArray(["John", "Jane"]) → ["John", "Jane"]
 * coerceStringArray(null) → []
 * coerceStringArray("") → []
 */
export function coerceStringArray(val: any): string[] {
  if (val == null) return [];
  
  // Already an array
  if (Array.isArray(val)) {
    return val
      .filter(x => x != null)
      .map(x => String(x).trim())
      .filter(x => x.length > 0);
  }
  
  // Single string
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return [];
    
    // Check if comma-separated (common Grok output format)
    if (trimmed.includes(',')) {
      return trimmed
        .split(',')
        .map(x => x.trim())
        .filter(x => x.length > 0);
    }
    
    return [trimmed];
  }
  
  // Other types (number, boolean, etc) - convert to string
  return [String(val)];
}

/**
 * Coerces a value to a string or null
 * Handles: numbers, booleans, actual strings, null/undefined
 * Trims whitespace and converts empty strings to null
 * 
 * @example
 * coerceString("hello") → "hello"
 * coerceString("  hello  ") → "hello"
 * coerceString(123) → "123"
 * coerceString(true) → "true"
 * coerceString("") → null
 * coerceString(null) → null
 */
export function coerceString(val: any): string | null {
  if (val == null) return null;
  
  const str = String(val).trim();
  return str.length > 0 ? str : null;
}

/**
 * Coerces a value to a boolean or null
 * Handles: string booleans, actual booleans, numbers, yes/no, null/undefined
 * 
 * @example
 * coerceBoolean(true) → true
 * coerceBoolean("true") → true
 * coerceBoolean("yes") → true
 * coerceBoolean(1) → true
 * coerceBoolean("false") → false
 * coerceBoolean("no") → false
 * coerceBoolean(0) → false
 * coerceBoolean(null) → null
 * coerceBoolean("invalid") → null
 */
export function coerceBoolean(val: any): boolean | null {
  if (val == null) return null;
  
  // Already boolean
  if (typeof val === 'boolean') return val;
  
  // String boolean
  if (typeof val === 'string') {
    const lower = val.toLowerCase().trim();
    if (lower === 'true' || lower === 'yes' || lower === '1') return true;
    if (lower === 'false' || lower === 'no' || lower === '0') return false;
  }
  
  // Number boolean (common in JSON)
  if (typeof val === 'number') {
    return val !== 0;
  }
  
  return null;
}

// ============================================================================
// COMPLEX TYPE COERCION
// ============================================================================

/**
 * Coerces a nested object with typed fields
 * Useful for objects like earnestMoneyDeposit { amount, holder }
 * 
 * @example
 * coerceObject(
 *   { amount: "5000", holder: "Escrow Inc" },
 *   { amount: coerceNumber, holder: coerceString }
 * )
 * → { amount: 5000, holder: "Escrow Inc" }
 */
export function coerceObject<T extends Record<string, any>>(
  obj: any,
  schema: Record<keyof T, (val: any) => any>
): T | null {
  if (obj == null || typeof obj !== 'object') return null;
  
  const coerced: any = {};
  let hasAnyData = false;
  
  for (const [key, coerceFn] of Object.entries(schema)) {
    const value = obj[key];
    const coercedValue = coerceFn(value);
    
    coerced[key] = coercedValue;
    
    if (coercedValue != null) {
      hasAnyData = true;
    }
  }
  
  // If all fields are null, return null for the whole object
  return hasAnyData ? (coerced as T) : null;
}

// ============================================================================
// LOGGING & DEBUGGING
// ============================================================================

/**
 * Tracks type coercions for logging/debugging
 * Returns modified value and whether coercion occurred
 */
export function trackCoercion<T>(
  original: any,
  coerced: T,
  fieldName: string
): { value: T; changed: boolean; log?: string } {
  const changed = JSON.stringify(original) !== JSON.stringify(coerced);
  
  if (!changed) {
    return { value: coerced, changed: false };
  }
  
  // Create readable log message
  const originalStr = original == null 
    ? 'null' 
    : typeof original === 'object'
      ? JSON.stringify(original)
      : String(original);
      
  const coercedStr = coerced == null
    ? 'null'
    : typeof coerced === 'object'
      ? JSON.stringify(coerced)
      : String(coerced);
  
  const log = `🔧 ${fieldName} coerced: ${originalStr} → ${coercedStr}`;
  
  return { value: coerced, changed: true, log };
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Checks if a value is "empty" after coercion
 * Useful for determining if Grok actually extracted data
 */
export function isEmpty(value: any): boolean {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  if (typeof value === 'number') return isNaN(value);
  return false;
}

/**
 * Gets the type name of a value for error messages
 */
export function getTypeName(value: any): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}