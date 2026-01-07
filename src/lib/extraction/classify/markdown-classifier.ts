// src/lib/extraction/classify/markdown-classifier.ts
// Version: 1.1.0 - 2026-01-07
// UPDATED: Added CA-specific form codes + patterns
// - Disclosures/advisories to exclude: AD, FVAC, BIA, PRBS, FHDA, BHIA, WFA, CCPA, SBSA, FRR-PA
// - Always include: CR-B (contingency_release), SMCO (counter_offer)
// - RR: Request for Repair – detect but post-processor will discard
// - State filtering: Added basic CA keyword check in detectFormCode/role (can refine)

import type { pageMetaData } from '@/types/classification';

const FORM_CODE_PATTERNS: Record<string, RegExp[]> = {
  RPA: [/RPA[-\s]*CA/i, /California Residential Purchase Agreement/i],
  'TREC 20-16': [/TREC NO\.? 20-16/i, /One to Four Family Residential Contract/i],
  'FAR/BAR-6': [/FAR\/BAR-6/i, /Florida Realtors\/Florida Bar/i],
  NVAR: [/NVAR/i, /Northern Virginia Association of Realtors/i],
  ADM: [/ADM/i, /Addendum/i],
  SCO: [/SCO/i, /Seller Counter Offer/i],
  BCO: [/BCO/i, /Buyer Counter Offer/i],
  APR: [/APR/i, /Contingency Removal/i],
  RR: [/RR/i, /Receipt for Reports/i, /Request for Repair/i], // Detect but post-processor discards
  // NEW: CA-specific
  AD: [/AD/i, /Disclosure Regarding Agency Relationship/i],
  FVAC: [/FVAC/i, /FHA\/VA Amendatory Clause/i],
  'CR-B': [/CR-B/i, /Contingency Removal/i],
  SMCO: [/SMCO/i, /Seller Multiple Counter Offer/i],
  'FRR-PA': [/FRR-PA/i, /Federal Reporting Requirement Purchase Addendum/i],
  BIA: [/BIA/i, /Buyer's Investigation Advisory/i],
  PRBS: [/PRBS/i, /Possible Representation of More Than One Buyer or Seller/i],
  FHDA: [/FHDA/i, /Fair Housing and Discrimination Advisory/i],
  BHIA: [/BHIA/i, /Buyer Homeowner's Insurance Advisory/i],
  WFA: [/WFA/i, /Wire Fraud and Electronic Funds Transfer Advisory/i],
  CCPA: [/CCPA/i, /California Consumer Privacy Act Advisory/i],
  SBSA: [/SBSA/i, /Statewide Buyer and Seller Advisory/i],
  // Add more as needed – universal across states
};

const ROLE_KEYWORDS: Record<string, string[]> = {
  main_contract: ['Purchase Agreement', 'Sales Contract', 'Residential Purchase', 'TREC 20-16', 'FAR/BAR'],
  counter_offer: ['Counter Offer', 'SCO', 'BCO', 'Multiple Counter', 'SMCO'],
  addendum: ['Addendum', 'ADM', 'Amendment'],
  local_addendum: ['Local Addendum', 'Regional Addendum', 'FRR-PA'], // Supplemental but treat as local
  contingency_release: ['Contingency Removal', 'APR', 'RR', 'Release of Contingencies', 'CR-B'],
  disclosure: ['Disclosure', 'Seller Property Questionnaire', 'Transfer Disclosure', 'AD', 'FVAC', 'BIA', 'PRBS', 'FHDA', 'BHIA', 'WFA', 'CCPA', 'SBSA'],
  broker_info: ['Broker Compensation', 'Agency Disclosure', 'FVAC'], // FVAC is broker-related disclosure
  title_page: ['Cover Sheet', 'Table of Contents'],
};

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  transaction_terms: ['purchase price', 'earnest money', 'deposit', 'closing date', 'financing', 'contingencies', 'items included'],
  signatures: ['buyer signature', 'seller signature', 'acceptance', 'date signed'],
  broker_info: ['broker', 'agent', 'compensation', 'commission'],
  disclosures: ['disclosure', 'hazard', 'lead based', 'natural hazard', 'advisory', 'privacy act', 'fair housing'],
  boilerplate: [], // fallback if nothing matches
};

function detectFormCode(markdown: string): string {
  const lower = markdown.toLowerCase();
  // Basic state filter: Skip if not CA (e.g., no 'California' mention) – can refine
  if (!/california/i.test(markdown)) {
    return 'UNKNOWN'; // Filter non-CA
  }
  for (const [code, patterns] of Object.entries(FORM_CODE_PATTERNS)) {
    if (patterns.some(p => p.test(markdown))) {
      return code;
    }
  }
  return 'UNKNOWN';
}

function detectRole(markdown: string, formCode: string): string {
  const lower = markdown.toLowerCase();
  for (const [role, keywords] of Object.entries(ROLE_KEYWORDS)) {
    if (keywords.some(k => lower.includes(k.toLowerCase()))) {
      return role;
    }
  }
  if (formCode !== 'UNKNOWN') return 'main_contract'; // strong signal for primary forms
  return 'other';
}

function detectContentCategory(markdown: string): string {
  const lower = markdown.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.length === 0) continue;
    if (keywords.some(k => lower.includes(k))) {
      return cat;
    }
  }
  // Heuristic: lots of dollar amounts + dates → transaction_terms
  if ((lower.match(/\$/g) || []).length >= 3 && lower.includes('date')) {
    return 'transaction_terms';
  }
  // Signature lines
  if (lower.includes('signature') || lower.includes('date signed')) {
    return 'signatures';
  }
  return 'boilerplate';
}

function hasFilledFieldsHeuristic(markdown: string): boolean {
  // Conservative: look for common filled patterns (dates, dollars, checked boxes)
  // NOTE: Raised threshold to 4+ to avoid tripping on signature-only pages with dates + multiple sig lines
  const filledPatterns = [
    /\d{1,2}\/\d{1,2}\/\d{2,4}/, // dates
    /\$\d{1,3}(,\d{3})*(\.\d{2})?/, // money
    /\b(yes|no|x)\b/i, // checkboxes
    /\bchecked\b/i,
  ];
  const matches = filledPatterns.filter(p => p.test(markdown)).length;
  return matches >= 4; // Increased from 3 to reduce false positives on sig/date-only forms
}

export function classifyFromMarkdown(pages: { markdown: string }[]): pageMetaData[] {
  return pages.map((page, index) => {
    const markdown = page.markdown;
    const formCode = detectFormCode(markdown);
    const role = detectRole(markdown, formCode);
    const contentCategory = detectContentCategory(markdown);
    const hasFilledFields = hasFilledFieldsHeuristic(markdown);

    return {
      pdfPage: index + 1,
      formCode,
      role,
      contentCategory,
      hasFilledFields,
      confidence: 85, // heuristic baseline – can tune
      footerText: markdown.slice(-300), // rough footer grab for metadata
      // Optional fields if we want to add later
      formPage: null,
      totalPagesInForm: null,
      titleSnippet: markdown.split('\n')[0]?.slice(0, 120) || '',
    };
  });
}