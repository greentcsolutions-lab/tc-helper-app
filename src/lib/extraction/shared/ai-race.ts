// src/lib/extraction/shared/ai-race.ts
// Version: 1.0.0 - 2026-01-15
// Unified AI racing system - pings all available AIs and uses the fastest responder

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
 * All available AI providers
 */
const AI_PROVIDERS: AIProvider[] = [
  {
    name: 'Claude',
    model: 'claude-haiku-4-5-20251001',
    checkAvailability: () => checkClaudeAvailability('claude-haiku-4-5-20251001', 5000),
    extract: extractWithClaude,
  },
  {
    name: 'Gemini',
    model: 'gemini-3-flash-preview',
    checkAvailability: () => checkGeminiAvailability('gemini-3-flash-preview', 5000),
    extract: extractWithGemini,
  },
];

/**
 * Race all AI providers and return the fastest available one
 * Returns the first AI to respond successfully to a ping
 */
export async function raceAIProviders(timeoutMs: number = 5000): Promise<AIProvider | null> {
  console.log(`[ai-race] Racing ${AI_PROVIDERS.length} AI providers...`);

  try {
    // Create ping promises for all providers
    const pingPromises = AI_PROVIDERS.map(async (provider) => {
      try {
        console.log(`[ai-race] Pinging ${provider.name}...`);
        const isAvailable = await provider.checkAvailability();

        if (isAvailable) {
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

    // Race all pings
    const winner = await Promise.race(
      pingPromises.map(async (promise, index) => {
        const result = await promise;
        if (result) {
          return { provider: result, index };
        }
        return null;
      })
    );

    if (!winner) {
      // No provider responded yet, wait for all to complete
      console.log(`[ai-race] No immediate winner, waiting for all providers...`);
      const results = await Promise.all(pingPromises);
      const firstAvailable = results.find(p => p !== null);

      if (firstAvailable) {
        console.log(`[ai-race] Winner: ${firstAvailable.name}`);
        return firstAvailable;
      }

      console.error(`[ai-race] No AI providers available`);
      return null;
    }

    console.log(`[ai-race] Winner: ${winner.provider.name} (responded first)`);
    return winner.provider;

  } catch (error: any) {
    console.error(`[ai-race] Race failed: ${error.message}`);
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
