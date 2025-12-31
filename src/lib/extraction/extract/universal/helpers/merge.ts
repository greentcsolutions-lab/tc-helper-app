// src/lib/extraction/extract/universal/helpers/merge.ts
// Version: 2.0.0 - 2025-12-31
// ENHANCED: Field-specific override logic with buyer/seller counter detection and deep merge

import type { EnrichedPageExtraction } from '@/types/extraction';
import { isEmpty } from '@/lib/grok/type-coercion';
import {
  isBuyerOriginatedField,
  isSellerOriginatedField,
  isNegotiableField,
  isInformationalField,
  deepMerge,
  isNestedObject,
} from './field-classification';
import { detectCounterOrigin } from './counter-detection';

const METADATA_FIELDS = ['pageNumber', 'pageLabel', 'formCode', 'formPage', 'pageRole', 'confidence'] as const;

export function stripMetadata(pageData: Record<string, any>): void {
  METADATA_FIELDS.forEach(field => delete pageData[field]);
}

/**
 * Merge multiple pages from the SAME role (e.g., multiple main_contract pages)
 * Rule: First non-null wins, later page numbers override if both have values
 */
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

/**
 * Apply overrides from counter offers or addenda with field-specific logic
 * 
 * Field-specific rules:
 * 1. BUYER-ORIGINATED fields: Only buyer counters can override
 * 2. SELLER-ORIGINATED fields: Only seller counters can override
 * 3. NEGOTIABLE fields: Any counter/addendum can override (uses deep merge)
 * 4. INFORMATIONAL fields: Special handling (address normalization, broker merge, etc.)
 */
export function applyOverrides(
  baseline: Record<string, any>,
  overridePages: EnrichedPageExtraction[],
  source: string,
  provenance: Record<string, number>,
  log: string[],
  allPages: EnrichedPageExtraction[]
): Record<string, any> {
  const result = { ...baseline };
  
  for (const page of overridePages) {
    const pageData: Record<string, any> = { ...page };
    stripMetadata(pageData);
    
    // Detect counter origin for field-specific rules
    const counterOrigin = source === 'COUNTER_OFFER' 
      ? detectCounterOrigin(page, allPages)
      : null;
    
    for (const [key, value] of Object.entries(pageData)) {
      if (value == null || isEmpty(value)) continue;
      
      // ========================================================================
      // RULE 1: BUYER-ORIGINATED FIELDS (only buyer counters can override)
      // ========================================================================
      if (isBuyerOriginatedField(key)) {
        if (source === 'COUNTER_OFFER' && counterOrigin === 'buyer') {
          result[key] = value;
          provenance[key] = page.pageNumber;
          log.push(`✓ ${key} from BUYER counter page ${page.pageNumber}`);
        } else if (source === 'COUNTER_OFFER') {
          log.push(`⊘ SKIPPED ${key} from ${counterOrigin?.toUpperCase() || 'UNKNOWN'} counter page ${page.pageNumber} (buyer fields require buyer counter)`);
        } else {
          // Non-counter override (addendum, signatures, etc.) - allow
          result[key] = value;
          provenance[key] = page.pageNumber;
          log.push(`✓ ${key} from ${source} page ${page.pageNumber}`);
        }
        continue;
      }
      
      // ========================================================================
      // RULE 2: SELLER-ORIGINATED FIELDS (only seller counters can override)
      // ========================================================================
      if (isSellerOriginatedField(key)) {
        if (source === 'COUNTER_OFFER' && counterOrigin === 'seller') {
          result[key] = value;
          provenance[key] = page.pageNumber;
          log.push(`✓ ${key} from SELLER counter page ${page.pageNumber}`);
        } else if (source === 'COUNTER_OFFER') {
          log.push(`⊘ SKIPPED ${key} from ${counterOrigin?.toUpperCase() || 'UNKNOWN'} counter page ${page.pageNumber} (seller fields require seller counter)`);
        } else {
          // Non-counter override (addendum, signatures, etc.) - allow
          result[key] = value;
          provenance[key] = page.pageNumber;
          log.push(`✓ ${key} from ${source} page ${page.pageNumber}`);
        }
        continue;
      }
      
      // ========================================================================
      // RULE 3: NEGOTIABLE FIELDS (deep merge for nested objects)
      // ========================================================================
      if (isNegotiableField(key)) {
        if (isNestedObject(value) && isNestedObject(result[key])) {
          const before = JSON.stringify(result[key]);
          result[key] = deepMerge(result[key], value);
          const after = JSON.stringify(result[key]);
          
          if (before !== after) {
            log.push(`⚡ ${key} DEEP MERGED from ${source} page ${page.pageNumber}`);
            provenance[key] = page.pageNumber;
          }
        } else {
          const hadPrevious = result[key] != null;
          result[key] = value;
          provenance[key] = page.pageNumber;
          log.push(hadPrevious 
            ? `⚠️ ${key} OVERRIDDEN by ${source} page ${page.pageNumber}`
            : `✓ ${key} from ${source} page ${page.pageNumber}`
          );
        }
        continue;
      }
      
      // ========================================================================
      // RULE 4: INFORMATIONAL FIELDS (special handling)
      // ========================================================================
      if (isInformationalField(key)) {
        result[key] = handleInformationalField(
          key,
          result[key],
          value,
          page,
          source,
          log
        );
        if (result[key] === value) {
          provenance[key] = page.pageNumber;
        }
        continue;
      }
      
      // ========================================================================
      // DEFAULT: Apply override for all other fields
      // ========================================================================
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

/**
 * Handle informational fields with special logic
 * 
 * 1. Property Address: Detect substantial changes (TODO: add normalization)
 * 2. Brokers: Deep merge to get most complete info
 * 3. Escrow Holder: Allow explicit changes
 */
function handleInformationalField(
  key: string,
  currentValue: any,
  newValue: any,
  page: EnrichedPageExtraction,
  source: string,
  log: string[]
): any {
  
  // PROPERTY ADDRESS
  if (key === 'propertyAddress') {
    // If we don't have a current value, use new value
    if (!currentValue) {
      log.push(`✓ propertyAddress from ${source} page ${page.pageNumber}`);
      return newValue;
    }
    
    // TODO: Add address normalization logic
    // For now: if addresses are substantially different, use new value
    // const isSimilar = isAddressSubstantiallySimilar(currentValue, newValue);
    
    // Simple check: if substantially different, it's an explicit change
    const current = currentValue.toLowerCase().replace(/\s+/g, ' ').trim();
    const updated = newValue.toLowerCase().replace(/\s+/g, ' ').trim();
    
    if (current === updated) {
      log.push(`⊘ KEPT original propertyAddress (same as page ${page.pageNumber})`);
      return currentValue;
    }
    
    // Check if it's just formatting (St vs Street, Blvd vs Boulevard, etc.)
    const currentNormalized = current
      .replace(/\bst\b/g, 'street')
      .replace(/\bave\b/g, 'avenue')
      .replace(/\bblvd\b/g, 'boulevard')
      .replace(/\bdr\b/g, 'drive')
      .replace(/\brd\b/g, 'road')
      .replace(/\bln\b/g, 'lane')
      .replace(/\bct\b/g, 'court');
      
    const updatedNormalized = updated
      .replace(/\bst\b/g, 'street')
      .replace(/\bave\b/g, 'avenue')
      .replace(/\bblvd\b/g, 'boulevard')
      .replace(/\bdr\b/g, 'drive')
      .replace(/\brd\b/g, 'road')
      .replace(/\bln\b/g, 'lane')
      .replace(/\bct\b/g, 'court');
    
    if (currentNormalized === updatedNormalized) {
      log.push(`⊘ KEPT original propertyAddress (formatting variation on page ${page.pageNumber})`);
      return currentValue;
    }
    
    // Substantial change detected
    log.push(`⚠️ propertyAddress CHANGED from "${currentValue}" to "${newValue}" on page ${page.pageNumber}`);
    return newValue;
  }
  
  // BROKERS (deep merge - take most complete info)
  if (key === 'brokers') {
    const merged = deepMerge(currentValue || {}, newValue);
    const changed = JSON.stringify(currentValue) !== JSON.stringify(merged);
    
    if (changed) {
      log.push(`⚡ brokers DEEP MERGED from ${source} page ${page.pageNumber}`);
    }
    
    return merged;
  }
  
  // ESCROW HOLDER (allow explicit changes)
  if (key === 'escrowHolder') {
    if (newValue && newValue !== currentValue) {
      log.push(`⚠️ escrowHolder changed from "${currentValue}" to "${newValue}" on page ${page.pageNumber}`);
      return newValue;
    }
  }
  
  // Default: first non-null wins
  return currentValue || newValue;
}