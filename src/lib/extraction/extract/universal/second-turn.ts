// src/lib/extraction/extract/universal/second-turn.ts
// Version: 2.0.0 - 2025-12-31
// FIXED: Import PerPageExtraction from @/types/extraction (not post-processor)

import type { LabeledCriticalImage } from '@/types/classification';
import type { PerPageExtraction } from '@/types/extraction';
import { SECOND_TURN_PROMPT } from '../../prompts/second-turn-prompt';

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
  
  try {
    const requestBody = {
      model: 'grok-4-1-fast-reasoning',
      temperature: 0,
      max_tokens: 8192,
      messages: [
        {
          role: 'user',
          content: [
            { 
              type: 'text', 
              text: `${enhancedPrompt}\n\nFocus on these problem fields: ${problemFields.join(', ')}\n\nRe-extract with EXTREME CARE:`
            },
            ...criticalImages.flatMap((img, idx) => [
              { 
                type: 'text', 
                text: `\n━━━ IMAGE ${idx + 1} OF ${criticalImages.length} ━━━\n` 
              },
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/png',
                  data: img.base64,
                },
              },
            ]),
          ],
        },
      ],
    };
    
    console.log(`[second-turn] Calling Grok API...`);
    
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[second-turn] ❌ API error: ${response.status} ${errorText}`);
      return {
        success: false,
        pageExtractions: firstTurnExtractions,
        error: `API error: ${response.status}`,
      };
    }
    
    const data = await response.json();
    const rawContent = data.choices[0].message.content;
    
    console.log(`[second-turn] Raw response length: ${rawContent.length} chars`);
    
    // Extract JSON from response
    const jsonMatch = rawContent.match(/\[\s*{[\s\S]*}\s*\]/);
    
    if (!jsonMatch) {
      console.error(`[second-turn] ❌ No JSON array found in response`);
      return {
        success: false,
        pageExtractions: firstTurnExtractions,
        error: 'No JSON found',
      };
    }
    
    const pageExtractions: PerPageExtraction[] = JSON.parse(jsonMatch[0]);
    
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