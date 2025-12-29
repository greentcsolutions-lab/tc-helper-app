// src/lib/extraction/extract/universal/second-turn.ts
// Version: 1.0.0 - 2025-12-29
// NEW: Second-turn extraction for low-confidence fields (FIX #5)

import type { LabeledCriticalImage } from '@/types/classification';
import type { PerPageExtraction } from './post-processor';
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
                text: `\n━━━ IMAGE ${idx + 1} OF ${criticalImages.length} ━━━\nPage ${img.pageNumber}: ${img.label}\n` 
              },
              { type: 'image_url', image_url: { url: img.base64 } },
            ]),
          ],
        },
      ],
    };
    
    console.log(`[second-turn] Sending request to Grok...`);
    
    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.XAI_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });
    
    console.log(`[second-turn] Response status: ${res.status}`);
    
    if (!res.ok) {
      const text = await res.text();
      console.error(`[second-turn] ❌ Grok error ${res.status}:`, text.substring(0, 500));
      throw new Error(`Grok API error ${res.status}: ${text}`);
    }
    
    const data = await res.json();
    const content = data.choices[0].message.content.trim();
    
    console.log(`[second-turn] Raw response length: ${content.length} chars`);
    
    // Extract JSON array
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error(`[second-turn] ❌ No JSON array found in response`);
      throw new Error('No JSON array found in second-turn response');
    }
    
    let parsed: PerPageExtraction[];
    try {
      parsed = JSON.parse(jsonMatch[0]);
      console.log(`[second-turn] ✅ Parsed ${parsed.length} page extractions`);
    } catch (e: any) {
      console.error(`[second-turn] ❌ JSON parse failed:`, e.message);
      throw new Error(`Failed to parse second-turn response: ${e.message}`);
    }
    
    // Validate that problem fields were addressed
    const fixedFields = validateFixes(parsed, problemFields, firstTurnExtractions);
    console.log(`[second-turn] Fixed fields: ${fixedFields.join(', ')}`);
    
    console.log(`[second-turn] ${"═".repeat(60)}`);
    console.log(`[second-turn] SECOND-TURN COMPLETE`);
    console.log(`[second-turn] Fixed ${fixedFields.length}/${problemFields.length} problem fields`);
    console.log(`[second-turn] ${"═".repeat(60)}\n`);
    
    return {
      success: true,
      pageExtractions: parsed,
    };
    
  } catch (error: any) {
    console.error(`[second-turn] ❌ Second-turn extraction failed:`, error.message);
    console.error(`[second-turn] Stack:`, error.stack);
    
    return {
      success: false,
      pageExtractions: firstTurnExtractions,  // Fallback to first turn
      error: error.message,
    };
  }
}

/**
 * Extract problem field names from validation errors
 */
function extractProblemFields(errors: string[]): string[] {
  const fields = new Set<string>();
  
  for (const error of errors) {
    if (error.includes('Purchase price is $0')) {
      fields.add('purchasePrice');
    }
    if (error.includes('Property address is missing')) {
      fields.add('propertyAddress');
    }
    if (error.includes('No buyer names')) {
      fields.add('buyerNames');
    }
    if (error.includes('Earnest money')) {
      fields.add('earnestMoneyDeposit');
    }
    if (error.includes('Closing date is missing')) {
      fields.add('closingDate');
    }
    if (error.includes('loan type')) {
      fields.add('financing.loanType');
    }
  }
  
  return Array.from(fields);
}

/**
 * Validate that second-turn fixed the problem fields
 */
function validateFixes(
  secondTurn: PerPageExtraction[],
  problemFields: string[],
  firstTurn: PerPageExtraction[]
): string[] {
  const fixed: string[] = [];
  
  for (const field of problemFields) {
    const secondValue = getFieldValue(secondTurn, field);
    const firstValue = getFieldValue(firstTurn, field);
    
    // Check if second turn provided a better value
    if (secondValue && secondValue !== firstValue) {
      // Special validation for specific fields
      if (field === 'purchasePrice' && typeof secondValue === 'number' && secondValue > 0) {
        fixed.push(field);
      } else if (field === 'propertyAddress' && typeof secondValue === 'string' && secondValue.trim() !== '') {
        fixed.push(field);
      } else if (field === 'buyerNames' && Array.isArray(secondValue) && secondValue.length > 0) {
        fixed.push(field);
      } else if (secondValue !== null && secondValue !== undefined) {
        fixed.push(field);
      }
    }
  }
  
  return fixed;
}

/**
 * Get field value from page extractions array
 */
function getFieldValue(pages: PerPageExtraction[], field: string): any {
  for (const page of pages) {
    if (field.includes('.')) {
      // Handle nested fields (e.g., "financing.loanType")
      const parts = field.split('.');
      let value: any = page;
      for (const part of parts) {
        value = value?.[part];
      }
      if (value !== null && value !== undefined) {
        return value;
      }
    } else {
      // Handle top-level fields
      const value = (page as any)[field];
      if (value !== null && value !== undefined) {
        return value;
      }
    }
  }
  return null;
}