// src/app/onboarding/types.ts
// Version 1.0.1 01/20/2026

export const usStates = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
] as const;

export type State = typeof usStates[number];

export const roleOptions = [
  { value: "transaction_coordinator", label: "Independent Transaction Coordinator" },
  { value: "office_admin", label: "Office Admin / TC" },
  { value: "solo_agent", label: "Solo Agent" },
  { value: "team_agent", label: "Team Agent" },
  { value: "team_leader", label: "Team Leader" },
  { value: "broker_ceo", label: "Broker or CEO" },
  { value: "other", label: "Other" },
] as const;

export const problemOptions = [
  { value: "contract_extraction", label: "Contract terms extraction" },
  { value: "team_workflows", label: "Team workflows" },
  { value: "task_management", label: "Task management" },
  { value: "timeline_management", label: "Timeline management" },
  { value: "other", label: "Other" },
] as const;

export const referralOptions = [
  { value: "google", label: "Google" },
  { value: "x", label: "X (Twitter)" },
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "referral", label: "Referral" },
  { value: "other", label: "Other" },
] as const;

export interface OnboardingFormData {
  name: string;
  email: string;
  phone: string | null;
  state: State | null;
  role: string;
  problems: string[];
  referralSource: string;
  onboarded: boolean;
}