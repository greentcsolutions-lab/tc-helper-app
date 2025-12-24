// src/lib/extraction/extract/universal/index.ts
// Version: 3.2.0-safe-wrappers - 2025-12-24
// Fixed: Graceful handling when Grok omits confidence/handwriting_detected
// Enhanced: Logs raw formPage from classifier for duplicate detection

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
  extracted?: UniversalExtractionResult;
  confidence?: Record<string, number> & { overall_confidence?: number };
  handwriting_detected?: boolean;
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
    '[universalExtractor] Critical page numbers (sorted):',
    criticalImages.map((img) => img.pageNumber).sort((a, b) => a - b)
  );

  // NEW: Log exact form pages Grok assigned (helps spot duplicates/missequencing)
  const formPageMap = new Map<number, number | null>();
  criticalImages.forEach((img) => {
    // Parse formPage from label if available (fallback from post-processor)
    const match = img.label.match(/PAGE (\d+)/i);
    const reportedFormPage = match ? parseInt(match[1], 10) : null;
    formPageMap.set(img.pageNumber, reportedFormPage);
  });
  console.log('[universalExtractor] Reported form pages per PDF page:');
  Array.from(formPageMap.entries())
    .sort((a, b) => a[0] - b[0])
    .forEach(([pdfPage, formPage]) => {
      console.log(`   PDF Page ${pdfPage} → Form Page ${formPage ?? 'unknown'}`);
    });

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

    // === RAW RESPONSE LOGGING ===
    console.log('[universalExtractor] === RAW GROK RESPONSE START ===');
    console.log('[universalExtractor] Full length:', content.length, 'characters');
    const preview500 = content.slice(0, 500);
    console.log('[universalExtractor] Raw response (first 500 chars):');
    console.log(preview500);
    if (content.length > 500) {
      console.log('[universalExtractor] ... (truncated)');
    }
    if (content.length <= 2000) {
      console.log('[universalExtractor] Full raw response:');
      console.log(content);
    }
    console.log('[universalExtractor] === RAW GROK RESPONSE END ===');

    const jsonMatch = content.match(/{[\s\S]*}/);
    if (!jsonMatch) {
      console.error('[universalExtractor] NO JSON BLOCK FOUND');
      console.log('[universalExtractor] Full raw content:');
      console.log(content);
      return fallbackResult();
    }

    let parsed: GrokExtractionResponse;
    try {
      parsed = JSON.parse(jsonMatch[0]);

      console.log('[universalExtractor] ✅ Successfully parsed JSON');

      if (!parsed.extracted) {
        console.warn('[universalExtractor] Missing "extracted" field → forcing review');
        return fallbackResult();
      }

      // Log key extracted fields
      console.log('[universalExtractor] Extracted core fields:', {
        buyerNames: parsed.extracted.buyerNames ?? [],
        sellerNames: parsed.extracted.sellerNames ?? [],
        propertyAddress: parsed.extracted.propertyAddress ?? '',
        purchasePrice: parsed.extracted.purchasePrice ?? 0,
        earnestMoneyAmount: parsed.extracted.earnestMoneyDeposit?.amount ?? null,
        closingDate: parsed.extracted.closingDate,
        isAllCash: parsed.extracted.financing?.isAllCash ?? true,
        loanType: parsed.extracted.financing?.loanType ?? null,
        effectiveDate: parsed.extracted.effectiveDate,
      });

      // === SAFE DEFAULTS FOR OPTIONAL WRAPPERS ===
      const confidence = parsed.confidence ?? {};
      const overallConfidence =
        typeof confidence.overall_confidence === 'number'
          ? confidence.overall_confidence
          : 95; // High default if missing

      const handwritingDetected = parsed.handwriting_detected === true;

      console.log('[universalExtractor] Confidence scores (with defaults):', {
        ...confidence,
        overall_confidence: overallConfidence,
      });
      console.log('[universalExtractor] handwriting_detected:', handwritingDetected);

      const needsReview =
        overallConfidence < 80 ||
        (confidence.purchasePrice ?? 100) < 90 ||
        (confidence.buyerNames ?? 100) < 90 ||
        handwritingDetected;

      console.log(`[universalExtractor] Needs human review: ${needsReview}`);
      console.log(`[universalExtractor] Effective overall confidence: ${overallConfidence}%`);

      return {
        universal: parsed.extracted,
        details: null,
        timelineEvents: [],
        needsReview,
      };
    } catch (e) {
      console.error('[universalExtractor] ❌ JSON parse failed', e);
      console.log('[universalExtractor] Bad JSON:', jsonMatch[0]);
      return fallbackResult();
    }
  } catch (error: any) {
    console.error('[universalExtractor] Unexpected error:', error);
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