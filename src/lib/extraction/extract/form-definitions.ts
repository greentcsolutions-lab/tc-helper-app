// src/lib/extraction/extract/form-definitions.ts
// Version: 1.0.0 - 2025-12-18
// California real estate form specifications

export interface FormDefinition {
  name: string;
  footerPattern: RegExp;
  description: string;
}

export interface RPADefinition extends FormDefinition {
  requiredInternalPages: number[];
  totalPages: 17;
}

export interface CounterOfferDefinition extends FormDefinition {
  abbreviation: string;
  captureAllPages: true;
}

export interface AddendumDefinition extends FormDefinition {
  abbreviation: string;
  singlePage: true;
}

export const RPA_FORM: RPADefinition = {
  name: "CALIFORNIA RESIDENTIAL PURCHASE AGREEMENT AND JOINT ESCROW INSTRUCTIONS",
  footerPattern: /\(RPA PAGE (\d+) OF 17\)/i,
  requiredInternalPages: [1, 2, 3, 16, 17],
  totalPages: 17,
  description: "Main purchase agreement - need pages 1-3 (terms) and 16-17 (signatures/agents)",
};

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