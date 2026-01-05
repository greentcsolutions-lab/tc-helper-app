// src/lib/extraction/extract/universal/helpers/merge.ts
// Version: 3.0.0 - 2026-01-05
// REFACTORED: Role-based field allowlists — safe, simple, predictable merging

import type { EnrichedPageExtraction } from '@/types/extraction';
import { isEmpty } from '@/lib/grok/type-coercion';

/**
 * Defines which page roles are allowed to contribute to each field.
 * This is the single source of truth for merge safety.
 */
const FIELD_ALLOWED_ROLES: Readonly<Record<string, readonly EnrichedPageExtraction['pageRole'][]>> = {
  // Core parties — almost never change after original contract
  buyerNames: ['main_contract', 'counter_offer'],
  sellerNames: ['main_contract', 'counter_offer'],

  // Core transaction terms
  propertyAddress: ['main_contract', 'counter_offer'],
  purchasePrice: ['main_contract', 'counter_offer'],
  earnestMoneyDeposit: ['main_contract', 'counter_offer'],
  closing: ['main_contract', 'counter_offer'], // new field
  financing: ['main_contract', 'counter_offer'],

  // Contingencies and timelines
  contingencies: ['main_contract', 'counter_offer'],

  // Supplemental terms (often from addenda)
  personalPropertyIncluded: ['main_contract', 'addendum'],
  escrowHolder: ['main_contract', 'addendum'],
  closingCosts: ['main_contract', 'counter_offer', 'addendum'],

  // Additional terms — usually from addenda
  additionalTerms: ['main_contract', 'counter_offer', 'addendum'],

  // Broker information — ONLY from broker pages (fallback to main_contract)
  brokers: ['broker_info', 'main_contract'],

  // Signature dates — can appear on any page
  buyerSignatureDates: ['main_contract', 'counter_offer', 'addendum', 'broker_info'],
  sellerSignatureDates: ['main_contract', 'counter_offer', 'addendum', 'broker_info'],
} as const;

const METADATA_FIELDS = ['pageNumber', 'pageLabel', 'formCode', 'formPage', 'pageRole', 'confidence'] as const;

export function stripMetadata(pageData: Record<string, any>): void {
  METADATA_FIELDS.forEach(field => delete pageData[field]);
}

/**
 * Unified merge function used for ALL roles.
 * 
 * Rules:
 * - Only fields explicitly allowed for the page's role are considered
 * - First non-null value wins
 * - Within the same role, higher page number wins (useful for multi-page RPA)
 * - No accidental overrides from wrong document types
 */
export function mergeWithAllowlist(
  enrichedPages: EnrichedPageExtraction[],
  provenance: Record<string, number>,
  log: string[]
): Record<string, any> {
  const result: Record<string, any> = {};

  // Group pages by role
  const pagesByRole = new Map<EnrichedPageExtraction['pageRole'], EnrichedPageExtraction[]>();
  for (const page of enrichedPages) {
    const role = page.pageRole;
    if (!pagesByRole.has(role)) pagesByRole.set(role, []);
    pagesByRole.get(role)!.push(page);
  }

  // Process roles in priority order
  const roleOrder: EnrichedPageExtraction['pageRole'][] = [
    'main_contract',
    'counter_offer',
    'addendum',
    'broker_info',
  ];

  // Fields where we want to accumulate unique items across pages (instead of first-win)
  const ARRAY_ACCUMULATE_FIELDS = ['personalPropertyIncluded', 'additionalTerms'] as const;

  for (const role of roleOrder) {
    const pages = pagesByRole.get(role) || [];
    if (pages.length === 0) continue;

    log.push(`[merge] Processing ${pages.length} ${role} page(s)`);

    // Sort pages by pageNumber ascending so higher numbers can contribute later
    for (const page of pages.sort((a, b) => a.pageNumber - b.pageNumber)) {
      const pageData: Record<string, any> = { ...page };
      stripMetadata(pageData);

      for (const [key, value] of Object.entries(pageData)) {
        if (value == null || isEmpty(value)) continue;

        // === SAFETY CHECK: Is this field allowed from this role? ===
        const allowedRoles = FIELD_ALLOWED_ROLES[key];
        if (!allowedRoles || !allowedRoles.includes(role)) {
          log.push(`⊘ BLOCKED ${key} from ${role} page ${page.pageNumber} (not allowed)`);
          continue;
        }

        // === SPECIAL HANDLING: Accumulate unique array items ===
        if (ARRAY_ACCUMULATE_FIELDS.includes(key as any) && Array.isArray(value)) {
          const existing = Array.isArray(result[key]) ? result[key] : [];
          const newItems = value.filter((item: string) => typeof item === 'string' && item.trim() !== '');

          if (newItems.length === 0) continue;

          const combined = [...existing, ...newItems];
          // Dedupe: keep first occurrence (preserves original wording/casing)
          const seen = new Set<string>();
          const uniqueCombined: string[] = [];
          for (const item of combined) {
            const normalized = item.trim().toLowerCase();
            if (!seen.has(normalized)) {
              seen.add(normalized);
              uniqueCombined.push(item);
            }
          }

          result[key] = uniqueCombined;
          provenance[key] = page.pageNumber; // Track latest contributing page
          log.push(
            `📑 ${key}: added ${newItems.length} new item(s) → total ${uniqueCombined.length} unique (from ${role} page ${page.pageNumber})`
          );
          continue;
        }

        // === DEFAULT MERGE: First non-null wins, or higher page number in same role ===
        const existingSourcePage = provenance[key];
        const isSameRoleOverride =
          existingSourcePage !== undefined &&
          enrichedPages.find(p => p.pageNumber === existingSourcePage)?.pageRole === role;

        if (
          result[key] == null ||
          (isSameRoleOverride && page.pageNumber > existingSourcePage)
        ) {
          const action = result[key] == null ? '✓' : '↻';
          result[key] = value;
          provenance[key] = page.pageNumber;
          log.push(`${action} ${key} ← ${role} page ${page.pageNumber}`);
        }
      }
    }
  }

  return result;
}