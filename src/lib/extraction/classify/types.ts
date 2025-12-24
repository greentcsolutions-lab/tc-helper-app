// src/lib/extraction/classify/types.ts
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
  confidence: number;                // required
  contentCategory?: string;
  hasFilledFields?: boolean;
}

export interface GrokClassifierOutput {
  pages: (GrokPageResult)[];
}

export interface LabeledCriticalImage {
  pageNumber: number;
  base64: string;
  label: string;
}