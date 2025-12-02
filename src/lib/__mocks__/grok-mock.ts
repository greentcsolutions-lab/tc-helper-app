// lib/__mocks__/grok-mock.ts
export const mockPageFinderResult = {
  rpa_start_page: 6,
  rpa_end_page: 22,
  signature_page_1: 21,
  signature_page_2: 22,
};

export const mockCounterResult = {
  final_counter_page: 28,
  final_counter_type: "BCO" as const,
  summary: "Buyer Counter Offer #2 accepted 11/27/2025",
};