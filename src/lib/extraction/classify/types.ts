// src/lib/extraction/classify/types.ts
// Updated to include broker_info in enum

export interface GrokPageResult {
  pdfPage: number;
  formCode: string;
  formPage: number | null;
  footerText: string;
  state?: string | null;
  formRevision?: string | null;
  totalPagesInForm?: number | null;
  role: string;
  titleSnippet?: string;
  confidence: number;
  contentCategory?: string;
  hasFilledFields?: boolean;
}

export interface GrokClassifierOutput {
  pages: (GrokPageResult | null)[];
}

export interface LabeledCriticalImage {
  pageNumber: number;
  base64: string;
  label: string;
}