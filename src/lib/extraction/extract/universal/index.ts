// src/lib/extraction/extract/universal/index.ts
// Version 3.0.0 - 2025-12-23
// Real Grok-powered universal extractor with full resilience

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
  console.log('[universalExtractor] Starting Grok extraction on', criticalImages.length, 'critical pages');

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
        max_tokens: 8192, // Large limit to accommodate detailed responses
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

    const jsonMatch = content.match(/{[\s\S]*}/);
    if (!jsonMatch) {
      console.error('[universalExtractor] No JSON block found in response');
      return fallbackResult();
    }

    let parsed: GrokExtractionResponse;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error('[universalExtractor] Failed to parse JSON from Grok response', e);
      return fallbackResult();
    }

    // Validate required structure before accessing confidence
    if (
      !parsed.extracted ||
      typeof parsed.confidence !== 'object' ||
      typeof parsed.confidence.overall_confidence !== 'number'
    ) {
      console.warn('[universalExtractor] Invalid response structure → forcing review');
      return fallbackResult();
    }

    const needsReview =
      parsed.confidence.overall_confidence < 80 ||
      (parsed.confidence.purchasePrice ?? 100) < 90 ||
      (parsed.confidence.buyerNames ?? 100) < 90 ||
      parsed.handwriting_detected === true;

    console.log(`[universalExtractor] Success. Needs review: ${needsReview} | Overall confidence: ${parsed.confidence.overall_confidence}%`);

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
  return {
    universal: getEmptyUniversalResult(),
    details: null,
    timelineEvents: [] as TimelineEvent[],
    needsReview: true,
  };
}