// src/lib/extraction/classify/post-processor.ts
// Version: 3.7.0 - 2026-01-02
// FIX: Use WHITELIST for addendums to prevent all boilerplate forms
// - v3.7.0: Whitelist only 'transaction_terms' + 'boilerplate' for addendums
// - Excludes 'signatures', 'broker_info', 'disclosures', etc.
// - Counter offers always included (they modify contract regardless of category)
// - Prevents FVAC (broker_info), FRR-PA (disclosures), etc. from getting through
// Previous: 3.6.0 - Blacklist approach (signatures, disclosures)

import type { LabeledCriticalImage, pageMetaData } from '@/types/classification';

export function mergeDetectedPages(
  allGrokPages: (pageMetaData | null)[]
): pageMetaData[] {
  return allGrokPages.filter((p): p is pageMetaData => p !== null);
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
export function getCriticalPageNumbers(detectedPages: pageMetaData[]): number[] {
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
    if (['counter_offer', 'addendum', 'local_addendum', 'contingency_release'].includes(role)) {
      if (!hasFilled) {
        stats.excluded++;
        continue;
      }

      if (role === 'counter_offer' || role === 'contingency_release') {
        selected.add(page.pdfPage);
        stats.override++;
        continue;
      }

      const ADDENDUM_ALLOWED_CATEGORIES = ['transaction_terms', 'boilerplate'];

      if (!ADDENDUM_ALLOWED_CATEGORIES.includes(category)) {
        stats.excluded++;
        continue;
      }

      selected.add(page.pdfPage);
      stats.override++;
      continue;
    }

    // ========================================================================
    // RULE 2: Main contract pages
    // ========================================================================
    if (role === 'main_contract') {
      if (category === 'signatures' || category === 'broker_info') {
        selected.add(page.pdfPage);
        stats.main++;
        continue;
      }

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
    stats.excluded++;
  }

  const sortedPages = Array.from(selected).sort((a, b) => a - b);

  console.log(
    `[select] ${sortedPages.length} critical: [${sortedPages.join(',')}] main=${stats.main} override=${stats.override} excl=${stats.excluded}`
  );

  return sortedPages;
}

export function buildUniversalPageLabels(
  detectedPages: pageMetaData[],
  criticalPageNumbers: number[]
): Map<number, string> {
  const labelMap = new Map<number, string>();

  // Universal form code display names (all U.S. states)
  const ADDENDUM_DISPLAY_CODES = {
    // California
    RPA: 'RPA',
    SCO: 'SCO',
    BCO: 'BCO',
    SMCO: 'SMCO',
    ADM: 'ADM',
    FVAC: 'FVAC',
    FRPA: 'FRPA',
    AEA: 'AEA',
    APR: 'APR',
    RR: 'RR',
    TOA: 'TOA',
    PRBS: 'PRBS',
    AD: 'AD',
    FRA: 'FRA',
    BIA: 'BIA',
    BHIA: 'BHIA',
    WFA: 'WFA',
    COPA: 'COPA',
    FHDA: 'FHDA',
    CPDA: 'CPDA',
    RPMA: 'RPMA',

    // Texas (TREC forms)
    'TREC 20-16': 'TREC',
    'TREC 1-4': 'TREC-AMD',
    'TREC 38-9': 'TREC-REL',
    'TREC 39-9': 'TREC-CO',
    'TREC 9-13': 'TREC-ADD',
    TREC: 'TREC',

    // Florida (FAR/BAR forms)
    'FAR/BAR-6': 'FAR/BAR',
    'FAR/BAR-5': 'FAR/BAR-CO',
    'FAR/BAR-AS IS': 'FAR/BAR-AS',
    'FAR/BAR-9': 'FAR/BAR-AMD',
    'FAR/BAR': 'FAR/BAR',

    // Nevada
    NVAR: 'NVAR',
    'NV RPA': 'NV-RPA',

    // Generic/Universal
    Amendment: 'AMD',
    Addendum: 'ADM',
    'Counter Offer': 'CO',
    'Purchase Agreement': 'PA',
    'Sales Contract': 'SC',
    'Contingency Release': 'REL',
  } as const;

  detectedPages.forEach((page) => {
    const rawCode = (page.formCode ?? 'UNKNOWN').toString().trim();
    const formPage = page.formPage ?? '?';
    const role = page.role ?? '';
    const category = page.contentCategory ?? 'UNKNOWN';
    const filled = page.hasFilledFields ? ' (FILLED)' : '';

    // Use display code if available, otherwise use raw code
    const displayCode =
      (ADDENDUM_DISPLAY_CODES as Record<string, string>)[rawCode] ?? rawCode;

    // Build category display (replace all underscores)
    let categoryDisplay = category.toUpperCase().replace(/_/g, ' ');

    // Special handling for override documents
    if (['counter_offer', 'addendum', 'local_addendum', 'contingency_release'].includes(role)) {
      categoryDisplay = role.toUpperCase().replace(/_/g, ' ');
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
  detectedPages: pageMetaData[],
  criticalPageNumbers: number[]
) {
  // FIXED: Only extract form codes from critical pages (not all pages)
  // This prevents disclosure forms from affecting routing decisions
  const criticalPages = detectedPages.filter((p) =>
    criticalPageNumbers.includes(p.pdfPage)
  );

  const formCodes = Array.from(new Set(criticalPages.map((p) => p.formCode))).filter(
    Boolean
  ) as string[];

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