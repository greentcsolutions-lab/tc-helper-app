// src/types/classification.ts
// Version 2.0.0 - 2024-12-24
// Types related to document classification and page analysis
// Updated to include broker_info in enum

export interface pageMetaData {
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

export interface ClassifierOutput {
  pages: (pageMetaData
 | null)[];
}

export interface LabeledCriticalImage {
  pageNumber: number;
  base64: string;
  label: string;
}