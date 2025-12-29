// src/lib/extraction/prompts/index.ts
// Version: 6.0.0 - 2025-12-29
// REFACTORED: Split 380-line file into focused modules
// Public API remains unchanged - just cleaner internal organization

export { buildClassifierPrompt } from './classifier-prompt';
export { UNIVERSAL_EXTRACTOR_PROMPT } from './universal-extractor-prompt';
export { EXTRACTOR_PROMPT } from './california-extractor-prompt';
export { SECOND_TURN_PROMPT } from './second-turn-prompt';