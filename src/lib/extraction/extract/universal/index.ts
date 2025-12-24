// src/lib/extraction/extract/universal/index.ts
// Version: 3.1.0-debug - 2025-12-24
// Added extensive logging to debug blank extraction results

import { LabeledCriticalImage } from '../../classify/classifier';
import { UniversalExtractionResult } from './types';
import { UNIVERSAL_EXTRACTOR_PROMPT } from '../../prompts';

type TimelineEvent = {
  date: string;
  title: string;
  type: 'info' | 'warning' | 'critical';
  description?: string;
};

interface GrokExtractionResponse {
  extracted: UniversalExtractionResult;
  confidence: Record<keyof UniversalExtractionResult, number> & { overall_confidence: number };
  handwriting_detected: boolean;
}

export async function universalExtractor(
  criticalImages: LabeledCriticalImage[],
  packageMetadata: any
): Promise<{
  universal: UniversalExtractionResult;
  details: null;
  timelineEvents: TimelineEvent[];
  needsReview: boolean;
}> {
  console.log('[universalExtractor] Starting Grok extraction');
  console.log('[universalExtractor] Critical images count:', criticalImages.length);
  console.log(
    '[universalExtractor] Critical page numbers:',
    criticalImages.map((img) => img.pageNumber).sort((a, b) => a - b)
  );
  console.log(
    '[universalExtractor] Labels:',
    criticalImages.map((img) => `${img.pageNumber}: "${img.label}"`)
  );

  if (criticalImages.length === 0) {
    console.warn('[universalExtractor] No critical images → returning safe defaults');
    return fallbackResult();
  }

  const imageDescriptions = criticalImages
    .map((img) => `• Page ${img.pageNumber}: "${img.label}"`)
    .join('\n');

  const fullPrompt = `${UNIVERSAL_EXTRACTOR_PROMPT}\n\n${imageDescriptions}\n\nExtract now:`;

  try {
    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.XAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'grok-4-1-fast-reasoning',
        temperature: 0,
        max_tokens: 8192,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: fullPrompt },
              ...criticalImages.flatMap((img) => [
                { type: 'text', text: `\n━━━ Page ${img.pageNumber}: ${img.label} ━━━` },
                { type: 'image_url', image_url: { url: img.base64 } },
              ]),
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('[universalExtractor] Grok API error:', res.status, text);
      return fallbackResult();
    }

    const data = await res.json();
    const content = data.choices[0].message.content.trim();

    // === EXTENSIVE DEBUG LOGGING STARTS HERE ===
    console.log('[universalExtractor] RAW Grok response length:', content.length);
    console.log('[universalExtractor] RAW Grok response preview (first 1500 chars):');
    console.log(content.slice(0, 1500));
    if (content.length > 1500) {
      console.log('[universalExtractor] ... (truncated – full length:', content.length, ')');
    }

    const jsonMatch = content.match(/{[\s\S]*}/);
    if (!jsonMatch) {
      console.error('[universalExtractor] NO JSON BLOCK FOUND in Grok response');
      console.log('[universalExtractor] Full raw content for manual inspection:');
      console.log(content);
      return fallbackResult();
    }

    console.log('[universalExtractor] Extracted JSON block length:', jsonMatch[0].length);
    console.log('[universalExtractor] Extracted JSON preview (first 1000 chars):');
    console.log(jsonMatch[0].slice(0, 1000));

    let parsed: GrokExtractionResponse;
    try {
      parsed = JSON.parse(jsonMatch[0]);

      console.log('[universalExtractor] ✅ Successfully parsed JSON from Grok');
      console.log('[universalExtractor] Extracted core fields:');
      console.log('  buyerNames:', parsed.extracted.buyerNames);
      console.log('  sellerNames:', parsed.extracted.sellerNames);
      console.log('  propertyAddress:', parsed.extracted.propertyAddress);
      console.log('  purchasePrice:', parsed.extracted.purchasePrice);
      console.log('  earnestMoneyDeposit:', parsed.extracted.earnestMoneyDeposit);
      console.log('  closingDate:', parsed.extracted.closingDate);
      console.log('  isAllCash:', parsed.extracted.financing.isAllCash);
      console.log('  loanType:', parsed.extracted.financing.loanType);
      console.log('  effectiveDate:', parsed.extracted.effectiveDate);

      console.log('[universalExtractor] Confidence scores:', parsed.confidence);
      console.log('[universalExtractor] handwriting_detected:', parsed.handwriting_detected);

    } catch (e) {
      console.error('[universalExtractor] ❌ Failed to parse JSON from Grok response', e);
      console.log('[universalExtractor] Problematic JSON string:');
      console.log(jsonMatch[0]);
      return fallbackResult();
    }

    // Validate required structure
    if (
      !parsed.extracted ||
      typeof parsed.confidence !== 'object' ||
      typeof parsed.confidence.overall_confidence !== 'number'
    ) {
      console.warn('[universalExtractor] Invalid response structure → forcing review');
      console.log('[universalExtractor] Parsed object:', parsed);
      return fallbackResult();
    }

    const needsReview =
      parsed.confidence.overall_confidence < 80 ||
      (parsed.confidence.purchasePrice ?? 100) < 90 ||
      (parsed.confidence.buyerNames ?? 100) < 90 ||
      parsed.handwriting_detected === true;

    console.log(`[universalExtractor] Extraction complete`);
    console.log(`[universalExtractor] Needs human review: ${needsReview}`);
    console.log(`[universalExtractor] Overall confidence: ${parsed.confidence.overall_confidence}%`);

    return {
      universal: parsed.extracted,
      details: null,
      timelineEvents: [],
      needsReview,
    };
  } catch (error: any) {
    console.error('[universalExtractor] Unexpected error during extraction:', error);
    return fallbackResult();
  }
}

function getEmptyUniversalResult(): UniversalExtractionResult {
  return {
    buyerNames: [],
    sellerNames: [],
    propertyAddress: '',
    purchasePrice: 0,
    earnestMoneyDeposit: { amount: null, holder: null },
    closingDate: null,
    financing: { isAllCash: true, loanType: null, loanAmount: null },
    contingencies: {
      inspectionDays: null,
      appraisalDays: null,
      loanDays: null,
      saleOfBuyerProperty: false,
    },
    closingCosts: { buyerPays: [], sellerPays: [], sellerCreditAmount: null },
    brokers: {
      listingBrokerage: null,
      listingAgent: null,
      sellingBrokerage: null,
      sellingAgent: null,
    },
    personalPropertyIncluded: [],
    effectiveDate: null,
    escrowHolder: null,
  };
}

function fallbackResult() {
  console.warn('[universalExtractor] Returning fallback empty result');
  return {
    universal: getEmptyUniversalResult(),
    details: null,
    timelineEvents: [] as TimelineEvent[],
    needsReview: true,
  };
}