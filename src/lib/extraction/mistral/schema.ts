// src/lib/extraction/mistral/schema.ts
// Version: 1.1.0 - 2026-01-07
// UPDATED: Export both extractor and classifier schemas from one file

// Universal extractor schema (used for final extraction)
export { default as mistralExtractorSchema } from '@/forms/universal/extractor.schema.json';

// Classifier schema (used for page-by-page classification)
export { default as mistralClassifierSchema } from '@/forms/classifier.schema.json'; // adjust exact path

// Optional: re-export types if needed elsewhere
// export type { ... } from ...