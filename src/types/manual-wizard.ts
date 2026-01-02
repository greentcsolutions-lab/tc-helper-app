// src/types/manual-wizard.ts
// Types for the manual transaction creation wizard

export interface AgentInfo {
  name: string;
  company: string;
  phone: string;
  email: string;
}

export interface TimelineDates {
  // Acceptance date is the reference point (day 0)
  acceptanceDate: string; // YYYY-MM-DD

  // Can be either number of days OR specific date (YYYY-MM-DD)
  initialDepositDays: number | string; // Business days from acceptance
  sellerDeliveryDays: number | string; // Calendar days from acceptance
  inspectionDays: number | string; // Calendar days from acceptance
  appraisalDays: number | string; // Calendar days from acceptance
  loanDays: number | string; // Calendar days from acceptance
  closingDays: number | string; // Calendar days from acceptance
}

export interface ManualTransactionData {
  // Step 1: Property Address
  propertyAddress: string;
  state: string;

  // Step 2: Transaction Type
  transactionType: 'listing' | 'escrow';

  // Step 3: Buyer Names (1-4)
  buyerNames: string[];

  // Step 4: Seller Names (1-4)
  sellerNames: string[];

  // Step 5: Listing Agent
  listingAgent: AgentInfo;

  // Step 6: Buyer's Agent
  buyersAgent: AgentInfo;
  isDualRepresentation: boolean;

  // Step 7-8: Timeline
  timeline: TimelineDates;
}

export const EMPTY_AGENT_INFO: AgentInfo = {
  name: '',
  company: '',
  phone: '',
  email: '',
};

export const CA_DEFAULT_TIMELINE_DAYS = {
  initialDepositDays: 3, // Business days
  sellerDeliveryDays: 7,
  inspectionDays: 17,
  appraisalDays: 17,
  loanDays: 17,
  closingDays: 30,
};

export type WizardStep =
  | 'property-address'
  | 'transaction-type'
  | 'buyer-names'
  | 'seller-names'
  | 'listing-agent'
  | 'buyers-agent'
  | 'acceptance-date'
  | 'timeline-dates'
  | 'review';

export const WIZARD_STEPS: WizardStep[] = [
  'property-address',
  'transaction-type',
  'buyer-names',
  'seller-names',
  'listing-agent',
  'buyers-agent',
  'acceptance-date',
  'timeline-dates',
  'review',
];

export const WIZARD_STEP_TITLES: Record<WizardStep, string> = {
  'property-address': 'Property Address',
  'transaction-type': 'Transaction Type',
  'buyer-names': 'Buyer Information',
  'seller-names': 'Seller Information',
  'listing-agent': 'Listing Agent',
  'buyers-agent': "Buyer's Agent",
  'acceptance-date': 'Acceptance Date',
  'timeline-dates': 'Timeline Dates',
  'review': 'Review & Submit',
};
