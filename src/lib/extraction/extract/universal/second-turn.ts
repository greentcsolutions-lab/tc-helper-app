// src/lib/extraction/extract/universal/second-turn.ts
// Version: 3.0.0 - 2026-01-01
// MAJOR UPDATE: Refactored to use centralized Grok client with retry logic and validation
// - Replaced direct fetch() call with callGrokAPIWithRetryAndValidation()
// - Fixed image format to match centralized client (image_url instead of Anthropic format)
// - Inherits JSON mode, retry logic, and enhanced logging from centralized client
// Previous: 2.0.0 - Import fix for PerPageExtraction

import type { LabeledCriticalImage } from '@/types/classification';
import type { PerPageExtraction } from '@/types/extraction';
import { SECOND_TURN_PROMPT } from '../../prompts/second-turn-prompt';
import { callGrokAPIWithRetryAndValidation, type GrokPage } from '@/lib/grok/client';

interface SecondTurnResult {
  success: boolean;
  pageExtractions: PerPageExtraction[];
  error?: string;
}

/**
 * Runs second-turn extraction for fields that failed validation
 * Focuses Grok on specific problem fields with enhanced scrutiny
 */
export async function runSecondTurnExtraction(
  criticalImages: LabeledCriticalImage[],
  firstTurnExtractions: PerPageExtraction[],
  validationErrors: string[],
  firstTurnResult: any
): Promise<SecondTurnResult> {
  console.log(`\n[second-turn] ${"═".repeat(60)}`);
  console.log(`[second-turn] STARTING SECOND-TURN EXTRACTION`);
  console.log(`[second-turn] ${"═".repeat(60)}`);
  console.log(`[second-turn] Validation errors to fix: ${validationErrors.length}`);
  console.log(`[second-turn] Errors: ${validationErrors.join(', ')}`);
  
  // Identify problem fields from errors
  const problemFields = extractProblemFields(validationErrors);
  console.log(`[second-turn] Problem fields identified: ${problemFields.join(', ')}`);
  
  // Build enhanced prompt focusing on problem fields
  const previousJson = JSON.stringify(firstTurnResult, null, 2);
  const enhancedPrompt = SECOND_TURN_PROMPT
    .replace('{{PREVIOUS_JSON}}', previousJson)
    .replace('{{PROBLEM_FIELDS}}', problemFields.join(', '));
  
  console.log(`[second-turn] Enhanced prompt length: ${enhancedPrompt.length} chars`);

  // Convert critical images to GrokPage format
  const grokPages: GrokPage[] = criticalImages.map(img => ({
    pageNumber: img.pageNumber,
    base64: `data:image/png;base64,${img.base64}`,
  }));

  // Build final prompt with problem field focus
  const finalPrompt = `${enhancedPrompt}\n\nFocus on these problem fields: ${problemFields.join(', ')}\n\nRe-extract with EXTREME CARE:`;

  try {
    console.log(`[second-turn] Calling Grok API via centralized client...`);

    // Use centralized client with retry logic and validation
    const pageExtractions = await callGrokAPIWithRetryAndValidation<PerPageExtraction[]>(
      finalPrompt,
      grokPages,
      {
        logPrefix: '[second-turn]',
        maxTokens: 8192,
        expectObject: false, // Expecting array of extractions
      },
      criticalImages.length // total pages in document context
    );

    console.log(`[second-turn] ✅ Successfully re-extracted ${pageExtractions.length} pages`);
    console.log(`[second-turn] ${"═".repeat(60)}\n`);
    
    return {
      success: true,
      pageExtractions,
    };
    
  } catch (error) {
    console.error(`[second-turn] ❌ Error:`, error);
    return {
      success: false,
      pageExtractions: firstTurnExtractions,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Extract problem field names from validation errors
 */
function extractProblemFields(errors: string[]): string[] {
  const fields = new Set<string>();
  
  for (const error of errors) {
    // "Missing buyer names" → "buyerNames"
    if (error.includes('buyer names')) fields.add('buyerNames');
    if (error.includes('seller names')) fields.add('sellerNames');
    if (error.includes('property address')) fields.add('propertyAddress');
    if (error.includes('purchase price')) fields.add('purchasePrice');
    if (error.includes('closing date')) fields.add('closingDate');
  }
  
  return Array.from(fields);
}