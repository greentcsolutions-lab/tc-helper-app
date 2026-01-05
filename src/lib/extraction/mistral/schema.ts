// src/lib/extraction/mistral/schema.ts
// Version: 1.0.1 - 2026-01-05
// FIXED: Removed invalid 'as const' on JSON import
// JSON imports are already immutable objects at runtime – no need for const assertion
// Re-export directly for cleanest type inference

export { default as mistralJsonSchema } from '@/forms/universal/extractor.schema.json';