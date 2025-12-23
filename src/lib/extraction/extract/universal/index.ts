// src/lib/extraction/extract/universal/index.ts
// Version: 2.0.0 - 2025-12-23
// Real Grok-powered universal extractor (fallback path)

import { LabeledCriticalImage } from '../../classify/classifier';
import { UniversalExtractionResult } from './types';
import { UNIVERSAL_EXTRACTOR_PROMPT } from '../../prompts';

// Define the timeline event shape (shared with router.ts)
type TimelineEvent = {
  date: string; // YYYY-MM-DD
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
    console.warn('[universalExtractor] No critical images → returning defaults');
    return {
      universal: getEmptyUniversalResult(),
      details: null,
      timelineEvents: [],
      needsReview: true,
    };
  }

  // Build dynamic image list for prompt
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
        max_tokens: 2048,
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
    const content = data.choices[0].message.content;

    // Extract JSON block
    const jsonMatch = content.match(/{[\s\S]*}/);
    if (!jsonMatch) {
      console.error('[universalExtractor] No JSON found in response');
      return fallbackResult();
    }

    let parsed: GrokExtractionResponse;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error('[universalExtractor] JSON parse failed', e);
      return fallbackResult();
    }

    // Confidence + handwriting gate
    const needsReview =
      parsed.confidence.overall_confidence < 80 ||
      parsed.confidence.purchasePrice < 90 ||
      (parsed.confidence.buyerNames ?? 100) < 90 ||
      parsed.handwriting_detected === true;

    console.log(`[universalExtractor] Extraction complete. Needs review: ${needsReview}`);
    console.log(`[universalExtractor] Overall confidence: ${parsed.confidence.overall_confidence}%`);

    return {
      universal: parsed.extracted,
      details: null,
      timelineEvents: [], // empty for universal path
      needsReview,
    };
  } catch (error: any) {
    console.error('[universalExtractor] Unexpected error:', error);
    return fallbackResult();
  }
}

// Helper: safe defaults on failure
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