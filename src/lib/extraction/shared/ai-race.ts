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
 * This function now prefers Gemini. It tries to get a response from Gemini
 * within a 5-second timeout. If it fails or times out, it will race
 * the other available providers.
 */
export async function raceAIProviders(timeoutMs: number = 5000): Promise<AIProvider | null> {
  console.log(`[ai-race] Attempting to use preferred provider: ${GEMINI_PROVIDER_NAME}`);

  const geminiProvider = AI_PROVIDERS.find(p => p.name === GEMINI_PROVIDER_NAME);

  if (geminiProvider) {
    const timeoutPromise = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error('Gemini timed out')), timeoutMs)
    );

    try {
      const geminiResult = await Promise.race([
        (async () => {
          if (await geminiProvider.checkAvailability()) {
            return geminiProvider;
          }
          return null;
        })(),
        timeoutPromise,
      ]);

      if (geminiResult) {
        console.log(`[ai-race] ✓ ${GEMINI_PROVIDER_NAME} responded within the timeout`);
        return geminiResult;
      }
    } catch (error: any) {
      console.warn(`[ai-race] ✗ ${GEMINI_PROVIDER_NAME} failed or timed out: ${error.message}`);
    }
  }

  console.log('[ai-race] Falling back to racing other providers...');
  const otherProviders = AI_PROVIDERS.filter(p => p.name !== GEMINI_PROVIDER_NAME);

  if (otherProviders.length === 0) {
    console.error('[ai-race] No other providers to fall back to.');
    return null;
  }

  try {
    const pingPromises = otherProviders.map(async (provider) => {
      try {
        console.log(`[ai-race] Pinging ${provider.name}...`);
        if (await provider.checkAvailability()) {
          console.log(`[ai-race] ✓ ${provider.name} responded`);
          return provider;
        } else {
          console.log(`[ai-race] ✗ ${provider.name} unavailable`);
          return null;
        }
      } catch (err: any) {
        console.warn(`[ai-race] ✗ ${provider.name} ping failed: ${err.message}`);
        return null;
      }
    });

    const results = await Promise.all(pingPromises);
    const firstAvailable = results.find(p => p !== null);

    if (firstAvailable) {
      console.log(`[ai-race] Winner: ${firstAvailable.name}`);
      return firstAvailable;
    }

    console.error(`[ai-race] No fallback AI providers available`);
    return null;
  } catch (error: any) {
    console.error(`[ai-race] Fallback race failed: ${error.message}`);
    return null;
  }
}

/**
 * Extract PDF using the fastest available AI provider
 * Falls back to next available provider if the winner fails
 */
export async function extractWithFastestAI(
  pdfUrl: string,
  totalPages: number
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
    const result = await winner.extract(pdfUrl, totalPages, winner.model);
    console.log(`[ai-race] Extraction successful with ${winner.name}`);
    return result;
  } catch (error: any) {
    console.error(`[ai-race] ${winner.name} extraction failed: ${error.message}`);

    // Try fallback to other providers
    console.log(`[ai-race] Attempting fallback to other providers...`);

    for (const provider of AI_PROVIDERS) {
      if (provider.name === winner.name) continue; // Skip the one that failed

      try {
        console.log(`[ai-race] Trying fallback: ${provider.name}...`);
        const isAvailable = await provider.checkAvailability();

        if (isAvailable) {
          const result = await provider.extract(pdfUrl, totalPages, provider.model);
          console.log(`[ai-race] Fallback successful with ${provider.name}`);
          return result;
        }
      } catch (fallbackError: any) {
        console.error(`[ai-race] Fallback ${provider.name} failed: ${fallbackError.message}`);
      }
    }

    throw new Error('All AI providers failed');
  }
}
