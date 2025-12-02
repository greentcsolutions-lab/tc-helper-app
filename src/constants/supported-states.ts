// src/constants/supported-states.ts
export const SUPPORTED_STATES = ["CA"] as const;
export type SupportedState = typeof SUPPORTED_STATES[number];