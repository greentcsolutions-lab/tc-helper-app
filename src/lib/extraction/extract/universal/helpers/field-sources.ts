// New file: src/lib/extraction/extract/universal/post-processor/helpers/field-sources.ts

const FIELD_SOURCES = {
  // Core parties — almost never change after original RPA
  buyerNames: ['main_contract', 'counter_offer'],
  sellerNames: ['main_contract', 'counter_offer'],

  // Core economics — can be changed by counters
  propertyAddress: ['main_contract', 'counter_offer'],
  purchasePrice: ['main_contract', 'counter_offer'],
  earnestMoneyDeposit: ['main_contract', 'counter_offer'],
  closing: ['main_contract', 'counter_offer'], // new field
  financing: ['main_contract', 'counter_offer'],

  // Contingencies — usually from main RPA, rarely modified
  contingencies: ['main_contract', 'counter_offer'],

  // Supplemental — usually from addenda
  personalPropertyIncluded: ['main_contract', 'addendum'],
  escrowHolder: ['main_contract', 'addendum'],
  closingCosts: ['main_contract', 'counter_offer', 'addendum'],

  // Broker info — ONLY from broker pages
  brokers: ['broker_info', 'main_contract'], // fallback to main if broker page missing

  // Dates from signatures — can come from any page (normalized later)
  buyerSignatureDates: ['main_contract', 'counter_offer', 'addendum', 'broker_info'],
  sellerSignatureDates: ['main_contract', 'counter_offer', 'addendum', 'broker_info'],
} as const;

type FieldKey = keyof typeof FIELD_SOURCES;