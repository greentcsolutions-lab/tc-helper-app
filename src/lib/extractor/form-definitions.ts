// src/lib/extractor/form-definitions.ts
// Version: 1.0.0 - California real estate form specifications
// Defines exact footer patterns and required pages for classification

export interface FormDefinition {
  name: string;
  footerPattern: RegExp;
  description: string;
}

export interface RPADefinition extends FormDefinition {
  requiredInternalPages: number[]; // Which internal RPA pages we need (1, 2, 3, 16, 17)
  totalPages: 17; // RPA is always 17 pages
}

export interface CounterOfferDefinition extends FormDefinition {
  abbreviation: string; // SCO, BCO, SMCO
  captureAllPages: true; // Always capture every page of every counter
}

export interface AddendumDefinition extends FormDefinition {
  abbreviation: string; // ADM, TOA, AEA
  singlePage: true; // These are always 1-page forms
}

/**
 * Main RPA form - we need specific internal pages
 * Internal pages 1-3: Purchase terms, property info, financial details
 * Internal pages 16-17: Signatures, agent contact info
 */
export const RPA_FORM: RPADefinition = {
  name: "CALIFORNIA RESIDENTIAL PURCHASE AGREEMENT AND JOINT ESCROW INSTRUCTIONS",
  footerPattern: /\(RPA PAGE (\d+) OF 17\)/i,
  requiredInternalPages: [1, 2, 3, 16, 17],
  totalPages: 17,
  description: "Main purchase agreement - need pages 1-3 (terms) and 16-17 (signatures/agents)",
};

/**
 * Counter Offers - capture EVERY page of EVERY counter found
 * Multiple counters are common (SCO #1, SCO #2, BCO #1, etc.)
 * Final terms may be spread across multiple counters
 */
export const COUNTER_OFFERS: CounterOfferDefinition[] = [
  {
    name: "SELLER COUNTER OFFER",
    abbreviation: "SCO",
    footerPattern: /\(SCO PAGE (\d+) OF 2\)/i,
    captureAllPages: true,
    description: "Seller counter offer - 2 pages each, capture all numbers",
  },
  {
    name: "BUYER COUNTER OFFER",
    abbreviation: "BCO",
    footerPattern: /\(BCO PAGE (\d+) OF 1\)/i,
    captureAllPages: true,
    description: "Buyer counter offer - 1 page each, capture all numbers",
  },
  {
    name: "SELLER MULTIPLE COUNTER OFFER",
    abbreviation: "SMCO",
    footerPattern: /\(SMCO PAGE (\d+) OF 2\)/i,
    captureAllPages: true,
    description: "Seller multiple counter offer - 2 pages each, capture all numbers",
  },
];

/**
 * Key Addenda - single-page forms with important modifications
 * ADM: General addendum with additional terms
 * TOA: Text overflow when standard fields run out of space
 * AEA: Amendments to existing agreement
 */
export const KEY_ADDENDA: AddendumDefinition[] = [
  {
    name: "ADDENDUM",
    abbreviation: "ADM",
    footerPattern: /\(ADM PAGE 1 OF 1\)/i,
    singlePage: true,
    description: "General addendum with additional terms",
  },
  {
    name: "TEXT OVERFLOW ADDENDUM",
    abbreviation: "TOA",
    footerPattern: /\(TOA PAGE 1 OF 1\)/i,
    singlePage: true,
    description: "Overflow addendum when standard fields are full",
  },
  {
    name: "AMENDMENT OF EXISTING AGREEMENT TERMS",
    abbreviation: "AEA",
    footerPattern: /\(AEA PAGE 1 OF 1\)/i,
    singlePage: true,
    description: "Amendment to existing agreement terms",
  },
];

/**
 * Helper: Generate footer examples for prompt
 */
export function getFooterExamples(): string {
  const rpaExamples = RPA_FORM.requiredInternalPages
    .map(p => `"(RPA PAGE ${p} OF 17)"`)
    .join(", ");

  const counterExamples = COUNTER_OFFERS
    .map(c => `"(${c.abbreviation} PAGE X OF Y)"`)
    .join(", ");

  const addendumExamples = KEY_ADDENDA
    .map(a => `"(${a.abbreviation} PAGE 1 OF 1)"`)
    .join(", ");

  return `
RPA Examples: ${rpaExamples}
Counter Examples: ${counterExamples}
Addendum Examples: ${addendumExamples}`;
}
