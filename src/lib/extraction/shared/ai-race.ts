// src/lib/extraction/shared/ai-race.ts
// Version: 1.1.0 - 2026-01-21
// Unified AI racing system - pings all available AIs and uses the fastest responder
// Prefers Gemini, falls back to other models on timeout

import { checkClaudeAvailability, extractWithClaude } from '@/lib/extraction/Claude/extractPdf';
import { checkGeminiAvailability, extractWithGemini } from '@/lib/extraction/gemini/extractPdf';

/**
 * AI provider configuration
 */
interface AIProvider {
  name: string;
  model: string;
  checkAvailability: () => Promise<boolean>;
  extract: (pdfUrl: string, totalPages: number, model: string) => Promise<any>;
}

/**
 * All available AI providers. Gemini is preferred.
 */
const AI_PROVIDERS: AIProvider[] = [
  {
    name: 'Gemini',
    model: 'gemini-3-flash-preview',
    checkAvailability: () => checkGeminiAvailability('gemini-3-flash-preview', 5000),
    extract: extractWithGemini,
  },
  {
    name: 'Claude',
    model: 'claude-haiku-4-5-20251001',
    checkAvailability: () => checkClaudeAvailability('claude-haiku-4-5-20251001', 5000),
    extract: extractWithClaude,
  },
];

const GEMINI_PROVIDER_NAME = 'Gemini';

/**
 * Race all AI providers and return the fastest available one.
 * This function now prefers Gemini and skips availability checks.
 * Returns Gemini immediately - if extraction fails, fallback logic handles it.
 */
export async function raceAIProviders(timeoutMs: number = 5000): Promise<AIProvider | null> {
  console.log(`[ai-race] Using preferred provider: ${GEMINI_PROVIDER_NAME} (skipping availability check)`);

  const geminiProvider = AI_PROVIDERS.find(p => p.name === GEMINI_PROVIDER_NAME);

  if (geminiProvider) {
    console.log(`[ai-race] ✓ ${GEMINI_PROVIDER_NAME} selected (will attempt extraction directly)`);
    return geminiProvider;
  }

  console.log('[ai-race] Gemini not found, falling back to other providers...');
  const otherProviders = AI_PROVIDERS.filter(p => p.name !== GEMINI_PROVIDER_NAME);

  if (otherProviders.length === 0) {
    console.error('[ai-race] No providers available.');
    return null;
  }

  // Return first alternative provider (Claude)
  console.log(`[ai-race] Using fallback: ${otherProviders[0].name}`);
  return otherProviders[0];
}

/**
 * Extract PDF using the fastest available AI provider
 * Falls back to next available provider if the winner fails
 */
export async function extractWithFastestAI(
  pdfUrl: string,
  totalPages: number,
  onProgress?: (message: string) => void
): Promise<{
  finalTerms: any;
  needsReview: boolean;
  criticalPages: string[];
  allExtractions: any[];
  modelUsed: string;
} | null> {
  console.log(`[ai-race] Starting extraction with fastest available AI...`);

  // Race all AI providers to find the fastest
  const winner = await raceAIProviders(5000);

  if (!winner) {
    throw new Error('No AI providers are currently available');
  }

  // Try extraction with the winner
  try {
    console.log(`[ai-race] Extracting with ${winner.name} (${winner.model})...`);

    // Send progress update if callback provided
    if (onProgress) {
      if (winner.name === 'Gemini') {
        onProgress('Reading through your contract');
      } else {
        onProgress('Analyzing your document');
      }
    }

    const result = await winner.extract(pdfUrl, totalPages, winner.model);
    console.log(`[ai-race] Extraction successful with ${winner.name}`);
    return result;
  } catch (error: any) {
    console.error(`[ai-race] ${winner.name} extraction failed: ${error.message}`);

    // Try fallback to other providers (skip availability checks, attempt extraction directly)
    console.log(`[ai-race] Attempting fallback to other providers...`);

    if (onProgress) {
      onProgress('Taking a closer look');
    }

    for (const provider of AI_PROVIDERS) {
      if (provider.name === winner.name) continue; // Skip the one that failed

      try {
        console.log(`[ai-race] Trying fallback: ${provider.name} (direct extraction)...`);
        const result = await provider.extract(pdfUrl, totalPages, provider.model);
        console.log(`[ai-race] Fallback successful with ${provider.name}`);
        return result;
      } catch (fallbackError: any) {
        console.error(`[ai-race] Fallback ${provider.name} failed: ${fallbackError.message}`);
      }
    }

    throw new Error('All AI providers failed');
  }
}
