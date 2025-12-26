// src/types/index.ts
// Public type barrel — the ONLY place the rest of the app imports types from
// Keeps public surface tiny and stable

export * from './parse-result';

// Future public types (enums, shared utilities, etc.) can be added here later
// Internal types stay in classification.ts and extraction.ts — never re-exported here