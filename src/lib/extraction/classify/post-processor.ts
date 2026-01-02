// src/lib/extraction/classify/post-processor.ts
// Version: 3.7.0 - 2026-01-02
// FIX: Use WHITELIST for addendums to prevent all boilerplate forms
// - v3.7.0: Whitelist only 'transaction_terms' + 'boilerplate' for addendums
// - Excludes 'signatures', 'broker_info', 'disclosures', etc.
// - Counter offers always included (they modify contract regardless of category)
// - Prevents FVAC (broker_info), FRR-PA (disclosures), etc. from getting through
// Previous: 3.6.0 - Blacklist approach (signatures, disclosures)

import type { LabeledCriticalImage, GrokPageResult } from '@/types/classification';

export function mergeDetectedPages(
  allGrokPages: (GrokPageResult | null)[]
): GrokPageResult[] {
  return allGrokPages.filter((p): p is GrokPageResult => p !== null);
}

/**
 * Selects critical pages for extraction using universal logic
 * Works for CA, TX, FL, NV, and all other U.S. states
 *
 * v3.7.0: Whitelist approach for addendums - ONLY transaction_terms + boilerplate
 * v3.6.0: Also exclude signature-only "addendums" (FVAC) - just one checkbox field
 * v3.5.0: Exclude disclosure "addendums" (FRR-PA, FRPA) - they're not real addendums
 * v3.4.0: Signature and broker pages now ALWAYS included, even when hasFilledFields=false
 */
export function getCriticalPageNumbers(detectedPages: GrokPageResult[]): number[] {
  const selected = new Set<number>();

  // Categories that contain extractable data (universal)
  const EXTRACTABLE_CATEGORIES = [
    'transaction_terms',  // Any fillable transaction data
    'signatures',         // Final acceptance dates (even if unsigned)
    'broker_info',        // Agent contact info (even if partially filled)
  ];

  // Categories to always exclude (universal)
  const EXCLUDED_CATEGORIES = [
    'disclosures',        // Standard disclosures (AD, BIA, PRL, etc.)
    'boilerplate',        // Dense legal text
    'other',              // Unknown/blank
  ];

  // Track stats compactly
  const stats = { override: 0, main: 0, excluded: 0 };

  for (const page of detectedPages) {
    const role = page.role ?? '';
    const category = page.contentCategory ?? '';
    const hasFilled = page.hasFilledFields ?? false;
    const formCode = page.formCode ?? '';

    // ========================================================================
    // RULE 1: Override documents (counters, addenda, amendments)
    // ========================================================================
    // These modify contract terms (not just boilerplate disclosures)
    // Examples: SCO, BCO, ADM, AEA, TOA, APR, RR, amendments
    if (['counter_offer', 'addendum', 'local_addendum', 'contingency_release'].includes(role)) {
      // Primary requirement: Must have filled fields
      if (!hasFilled) {
        stats.excluded++;
        continue;
      }

      // v3.7.0 FIX: Use WHITELIST for addendums to prevent broker_info forms
      // Counter offers and contingency releases: Always include (they modify contract)
      if (role === 'counter_offer' || role === 'contingency_release') {
        selected.add(page.pdfPage);
        stats.override++;
        continue;
      }

      // For addendums/local_addendums: ONLY include specific categories
      // Real addendums (ADM, AEA, TOA) have contentCategory='transaction_terms'
      // with multi-line text fields that modify contract terms.
      //
      // Boilerplate forms masquerading as addendums get excluded:
      // - FVAC (FHA/VA Clause): contentCategory='signatures' or 'broker_info'
      // - FRR-PA, FRPA (Reporting): contentCategory='disclosures'
      //
      // WHITELIST: Only 'transaction_terms' and 'boilerplate' (mislabeled addenda)
      const ADDENDUM_ALLOWED_CATEGORIES = ['transaction_terms', 'boilerplate'];

      if (!ADDENDUM_ALLOWED_CATEGORIES.includes(category)) {
        stats.excluded++;
        continue;
      }

      // Include: Real addendums with transaction-modifying content
      selected.add(page.pdfPage);
      stats.override++;
      continue;
    }

    // ========================================================================
    // RULE 2: Main contract pages
    // ========================================================================
    if (role === 'main_contract') {
      // v3.4.0 FIX: Check for signature/broker pages FIRST
      // These pages are ALWAYS critical, even when empty
      if (category === 'signatures' || category === 'broker_info') {
        selected.add(page.pdfPage);
        stats.main++;
        continue;
      }

      // For other main contract pages, apply standard filtering
      if (EXCLUDED_CATEGORIES.includes(category)) {
        stats.excluded++;
        continue;
      }

      if (!EXTRACTABLE_CATEGORIES.includes(category)) {
        stats.excluded++;
        continue;
      }

      if (!hasFilled) {
        stats.excluded++;
        continue;
      }

      selected.add(page.pdfPage);
      stats.main++;
      continue;
    }

    // ========================================================================
    // RULE 3: All other roles
    // ========================================================================
    // (disclosure, financing, title_page, other)
    // Note: True disclosures (AD, BIA, PRL, FPFA) have role="disclosure"
    // They are NEVER included, even if they say "addendum" in the title
    stats.excluded++;
  }

  const sortedPages = Array.from(selected).sort((a, b) => a - b);
  
  // Condensed logging - single line with all key info
  console.log(`[select] ${sortedPages.length} critical: [${sortedPages.join(',')}] main=${stats.main} override=${stats.override} excl=${stats.excluded}`);
  
  return sortedPages;
}

export function buildUniversalPageLabels(
  detectedPages: GrokPageResult[],
  criticalPageNumbers: number[]
): Map<number, string> {
  const labelMap = new Map<number, string>();

  // Universal form code display names (all U.S. states)
  const ADDENDUM_DISPLAY_CODES: Record<string, string> = {
    // California
    'RPA': 'RPA',
    'SCO': 'SCO',
    'BCO': 'BCO',
    'SMCO': 'SMCO',
    'ADM': 'ADM',
    'FVAC': 'FVAC',
    'FRPA': 'FRPA',
    'AEA': 'AEA',
    'APR': 'APR',
    'RR': 'RR',
    'TOA': 'TOA',
    'PRBS': 'PRBS',
    'AD': 'AD',
    'FRA': 'FRA',
    'BIA': 'BIA',
    'BHIA': 'BHIA',
    'WFA': 'WFA',
    'COPA': 'COPA',
    'FHDA': 'FHDA',
    'CPDA': 'CPDA',
    'RPMA': 'RPMA',
    
    // Texas (TREC forms)
    'TREC 20-16': 'TREC',
    'TREC 1-4': 'TREC-AMD',
    'TREC 38-9': 'TREC-REL',
    'TREC 39-9': 'TREC-CO',
    'TREC 9-13': 'TREC-ADD',
    'TREC': 'TREC',
    
    // Florida (FAR/BAR forms)
    'FAR/BAR-6': 'FAR/BAR',
    'FAR/BAR-5': 'FAR/BAR-CO',
    'FAR/BAR-AS IS': 'FAR/BAR-AS',
    'FAR/BAR-9': 'FAR/BAR-AMD',
    'FAR/BAR': 'FAR/BAR',
    
    // Nevada
    'NVAR': 'NVAR',
    'NV RPA': 'NV-RPA',
    
    // Generic/Universal
    'Amendment': 'AMD',
    'Addendum': 'ADM',
    'Counter Offer': 'CO',
    'Purchase Agreement': 'PA',
    'Sales Contract': 'SC',
    'Contingency Release': 'REL',
  } as const;

  detectedPages.forEach((page) => {
    const rawCode = page.formCode?.trim() || 'UNKNOWN';
    const formPage = page.formPage ?? '?';
    const role = page.role ?? '';
    const category = page.contentCategory || 'UNKNOWN';
    const filled = page.hasFilledFields ? ' (FILLED)' : '';

    // Use display code if available, otherwise use raw code
    const displayCode = ADDENDUM_DISPLAY_CODES[rawCode] ?? rawCode;
    
    // Build category display
    let categoryDisplay = category.toUpperCase().replace('_', ' ');
    
    // Special handling for override documents
    if (['counter_offer', 'addendum', 'local_addendum', 'contingency_release'].includes(role)) {
      categoryDisplay = role.toUpperCase().replace('_', ' ');
    }

    labelMap.set(
      page.pdfPage,
      `${displayCode} PAGE ${formPage} – ${categoryDisplay}${filled}`
    );
  });

  // Defensive fallback
  criticalPageNumbers.forEach((pdfPage) => {
    if (!labelMap.has(pdfPage)) {
      labelMap.set(pdfPage, `PAGE ${pdfPage} – KEY CONTRACT PAGE`);
    }
  });

  return labelMap;
}

export function buildLabeledCriticalImages(
  pages: { pageNumber: number; base64: string }[],
  criticalPageNumbers: number[],
  labelMap: Map<number, string>
): LabeledCriticalImage[] {
  return pages
    .filter((p) => criticalPageNumbers.includes(p.pageNumber))
    .map((p) => ({
      pageNumber: p.pageNumber,
      base64: p.base64,
      label: labelMap.get(p.pageNumber) || `PDF PAGE ${p.pageNumber}`,
    }));
}

export function extractPackageMetadata(
  detectedPages: GrokPageResult[],
  criticalPageNumbers: number[]
) {
  // FIXED: Only extract form codes from critical pages (not all pages)
  // This prevents disclosure forms from affecting routing decisions
  const criticalPages = detectedPages.filter((p) =>
    criticalPageNumbers.includes(p.pdfPage)
  );

  const formCodes = Array.from(new Set(criticalPages.map((p) => p.formCode))).filter(Boolean);

  const sampleFooters = detectedPages
    .map((p) => p?.footerText)
    .filter((text): text is string => typeof text === 'string' && text.trim() !== '')
    .slice(0, 5);

  return {
    detectedFormCodes: formCodes,
    sampleFooters,
    totalDetectedPages: detectedPages.length,
    hasMultipleForms: formCodes.length > 1,
  };
}