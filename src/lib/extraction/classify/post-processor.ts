// src/lib/extraction/classify/post-processor.ts
// Version: 3.1.1 - 2025-12-29
// FIXED: extractPackageMetadata now only uses critical pages for form codes
// This prevents disclosure forms from affecting routing decisions

import type { LabeledCriticalImage, GrokPageResult } from '@/types/classification';

export function mergeDetectedPages(
  allGrokPages: (GrokPageResult | null)[]
): GrokPageResult[] {
  return allGrokPages.filter((p): p is GrokPageResult => p !== null);
}

/**
 * Selects critical pages for extraction using universal logic
 * Works for CA, TX, FL, NV, and all other U.S. states
 */
export function getCriticalPageNumbers(detectedPages: GrokPageResult[]): number[] {
  const selected = new Set<number>();

  // Categories that contain extractable data (universal)
  const EXTRACTABLE_CATEGORIES = [
    'transaction_terms',  // Any fillable transaction data
    'signatures',         // Final acceptance dates
    'broker_info',        // Agent contact info
  ];

  // Categories to always exclude (universal)
  const EXCLUDED_CATEGORIES = [
    'disclosures',        // Standard disclosures
    'boilerplate',        // Dense legal text
    'other',              // Unknown/blank
  ];

  // DEBUG: Log full classification results
  console.log('\n[post-processor] === FULL CLASSIFICATION RESULTS ===');
  detectedPages.forEach((page) => {
    console.log(`[post-processor] Page ${page.pdfPage}: ${page.formCode} ${page.formPage}/${page.totalPagesInForm} | ${page.role} | ${page.contentCategory} | filled=${page.hasFilledFields}`);
  });
  console.log('[post-processor] ======================================\n');

  for (const page of detectedPages) {
    const role = page.role ?? '';
    const category = page.contentCategory ?? '';
    const hasFilled = page.hasFilledFields ?? false;
    const formCode = page.formCode ?? '';

    // RULE 1: Override documents (counters, addenda, contingency releases)
    // Universal - works for all states
    if (['counter_offer', 'addendum', 'local_addendum', 'contingency_release'].includes(role)) {
      // Must have extractable content (not just disclosures/boilerplate)
      if (EXCLUDED_CATEGORIES.includes(category)) {
        console.log(`[post-processor] ✗ Page ${page.pdfPage}: ${role} (${formCode}) → EXCLUDED (${category} content)`);
        continue;
      }

      // Must have filled fields
      if (!hasFilled) {
        console.log(`[post-processor] ✗ Page ${page.pdfPage}: ${role} (${formCode}) → EXCLUDED (no filled fields)`);
        continue;
      }

      console.log(`[post-processor] ✓ Page ${page.pdfPage}: ${role} (${formCode}) → INCLUDED (modifies terms)`);
      selected.add(page.pdfPage);
      continue;
    }

    // RULE 2: Main contract pages
    // Universal - works for all states
    if (role === 'main_contract') {
      // Must have extractable content
      if (EXCLUDED_CATEGORIES.includes(category)) {
        console.log(`[post-processor] ✗ Page ${page.pdfPage}: ${category} → EXCLUDED (excluded category)`);
        continue;
      }

      // Must be an extractable category
      if (!EXTRACTABLE_CATEGORIES.includes(category)) {
        console.log(`[post-processor] ✗ Page ${page.pdfPage}: ${category} → EXCLUDED (non-extractable category)`);
        continue;
      }

      // Must have filled fields
      if (!hasFilled) {
        console.log(`[post-processor] ✗ Page ${page.pdfPage}: ${category} → EXCLUDED (no filled fields)`);
        continue;
      }

      console.log(`[post-processor] ✓ Page ${page.pdfPage}: ${category} + filled → INCLUDED`);
      selected.add(page.pdfPage);
      continue;
    }

    // RULE 3: All other roles (disclosure, financing, broker_info, title_page, other)
    // Universal - always excluded
    console.log(`[post-processor] ✗ Page ${page.pdfPage}: ${role} → EXCLUDED (non-critical role)`);
  }

  const sortedPages = Array.from(selected).sort((a, b) => a - b);
  
  console.log(`\n[post-processor] FINAL SELECTION: ${sortedPages.length} pages → [${sortedPages.join(', ')}]`);
  
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