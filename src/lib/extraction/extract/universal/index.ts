// src/lib/extraction/extract/universal/index.ts
// Version: 3.4.0 - 2025-12-24
// ENHANCED: Deep debugging at every extraction step

import { LabeledCriticalImage } from '@/types/classification';
import { UniversalExtractionResult } from '@/types/extraction';
import { UNIVERSAL_EXTRACTOR_PROMPT } from '../../prompts';

type TimelineEvent = {
  date: string;
  title: string;
  type: 'info' | 'warning' | 'critical';
  description?: string;
};

function logDataShape(label: string, data: any) {
  console.log(`\n┌─── ${label} ${"─".repeat(Math.max(0, 60 - label.length))}`);
  
  if (data === null) {
    console.log(`│ null`);
  } else if (data === undefined) {
    console.log(`│ undefined`);
  } else if (Array.isArray(data)) {
    console.log(`│ Array[${data.length}]`);
    if (data.length > 0) {
      console.log(`│ Sample:`, JSON.stringify(data[0], null, 2).substring(0, 150));
    }
  } else if (typeof data === 'object') {
    console.log(`│ Object keys: [${Object.keys(data).join(', ')}]`);
    Object.entries(data).slice(0, 10).forEach(([key, value]) => {
      const valueType = Array.isArray(value) ? `Array(${value.length})` : typeof value;
      console.log(`│   ${key}: ${valueType}`);
    });
  } else {
    console.log(`│ ${typeof data}: ${String(data).substring(0, 100)}`);
  }
  
  console.log(`└${"─".repeat(63)}\n`);
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
  console.log(`\n${"═".repeat(80)}`);
  console.log(`║ 🤖 UNIVERSAL EXTRACTOR STARTED`);
  console.log(`${"═".repeat(80)}`);

  logDataShape("Input Critical Images", criticalImages);
  logDataShape("Package Metadata", packageMetadata);

  console.log(`[extractor:input] Critical images: ${criticalImages.length}`);
  
  criticalImages.forEach((img, idx) => {
    console.log(`[extractor:input]   ${idx + 1}. Page ${img.pageNumber}: "${img.label}"`);
    console.log(`[extractor:input]      Base64 length: ${img.base64.length} chars`);
  });

  if (criticalImages.length === 0) {
    console.warn(`[extractor:input] ⚠️ No critical images → returning fallback`);
    return fallbackResult();
  }

  // Build prompt with page descriptions
  const imageDescriptions = criticalImages
    .map((img) => `• Page ${img.pageNumber}: "${img.label}"`)
    .join('\n');

  const fullPrompt = `${UNIVERSAL_EXTRACTOR_PROMPT}\n\n${imageDescriptions}\n\nExtract now:`;

  console.log(`[extractor:prompt] Prompt length: ${fullPrompt.length} chars`);
  console.log(`[extractor:prompt] Image descriptions:`);
  console.log(imageDescriptions);

  try {
    console.log(`[extractor:api] Sending request to Grok...`);
    
    const requestBody = {
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
    };

    console.log(`[extractor:api] Request content blocks: ${requestBody.messages[0].content.length}`);

    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.XAI_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    console.log(`[extractor:api] Response status: ${res.status}`);

    if (!res.ok) {
      const text = await res.text();
      console.error(`[extractor:api] ❌ Grok error ${res.status}:`, text.substring(0, 500));
      return fallbackResult();
    }

    const data = await res.json();
    const content = data.choices[0].message.content.trim();

    console.log(`[extractor:response] Raw response length: ${content.length} chars`);
    console.log(`[extractor:response] === RAW GROK RESPONSE START ===`);
    console.log(`[extractor:response] First 500 chars:`);
    console.log(content.slice(0, 500));
    
    if (content.length > 500 && content.length <= 2000) {
      console.log(`[extractor:response] Full response:`);
      console.log(content);
    } else if (content.length > 2000) {
      console.log(`[extractor:response] Middle section (chars 1000-1500):`);
      console.log(content.slice(1000, 1500));
      console.log(`[extractor:response] Last 500 chars:`);
      console.log(content.slice(-500));
    }
    
    console.log(`[extractor:response] === RAW GROK RESPONSE END ===`);

    // Extract JSON
    const jsonMatch = content.match(/{[\s\S]*}/);
    if (!jsonMatch) {
      console.error(`[extractor:parse] ❌ NO JSON BLOCK FOUND`);
      console.log(`[extractor:parse] Full raw content:`);
      console.log(content);
      return fallbackResult();
    }

    console.log(`[extractor:parse] JSON block found, length: ${jsonMatch[0].length} chars`);

    let parsed: any;
    try {
      parsed = JSON.parse(jsonMatch[0]);
      console.log(`[extractor:parse] ✅ JSON parsed successfully`);
      logDataShape("Parsed JSON", parsed);
    } catch (e: any) {
      console.error(`[extractor:parse] ❌ JSON parse failed:`, e.message);
      console.log(`[extractor:parse] Attempted to parse:`, jsonMatch[0].substring(0, 1000));
      return fallbackResult();
    }

    // Flexible extraction (bare object OR wrapped in "extracted")
    let extractionData: UniversalExtractionResult;

    if (parsed.extracted) {
      console.log(`[extractor:structure] Response wrapped in "extracted" key`);
      extractionData = parsed.extracted;
      logDataShape("Extracted Data (from wrapped)", extractionData);
    } else if (parsed.buyerNames !== undefined || parsed.purchasePrice !== undefined) {
      console.log(`[extractor:structure] Bare object response – using directly`);
      extractionData = parsed as UniversalExtractionResult;
      logDataShape("Extracted Data (bare object)", extractionData);
    } else {
      console.warn(`[extractor:structure] ⚠️ No recognizable data structure → forcing review`);
      console.log(`[extractor:structure] Available keys:`, Object.keys(parsed).join(', '));
      return fallbackResult();
    }

    // Log all extracted fields
    console.log(`\n${"─".repeat(80)}`);
    console.log(`[extractor:fields] EXTRACTED CORE FIELDS:`);
    console.log(`${"─".repeat(80)}`);
    console.log(`[extractor:fields] buyerNames: ${JSON.stringify(extractionData.buyerNames ?? [])}`);
    console.log(`[extractor:fields] sellerNames: ${JSON.stringify(extractionData.sellerNames ?? [])}`);
    console.log(`[extractor:fields] propertyAddress: ${extractionData.propertyAddress ?? 'null'}`);
    console.log(`[extractor:fields] purchasePrice: ${extractionData.purchasePrice ?? 'null'}`);
    console.log(`[extractor:fields] earnestMoneyAmount: ${extractionData.earnestMoneyDeposit?.amount ?? 'null'}`);
    console.log(`[extractor:fields] earnestMoneyHolder: ${extractionData.earnestMoneyDeposit?.holder ?? 'null'}`);
    console.log(`[extractor:fields] closingDate: ${extractionData.closingDate ?? 'null'}`);
    console.log(`[extractor:fields] effectiveDate: ${extractionData.effectiveDate ?? 'null'}`);
    console.log(`[extractor:fields] isAllCash: ${extractionData.financing?.isAllCash ?? 'null'}`);
    console.log(`[extractor:fields] loanType: ${extractionData.financing?.loanType ?? 'null'}`);
    console.log(`[extractor:fields] loanAmount: ${extractionData.financing?.loanAmount ?? 'null'}`);
    console.log(`[extractor:fields] inspectionDays: ${extractionData.contingencies?.inspectionDays ?? 'null'}`);
    console.log(`[extractor:fields] appraisalDays: ${extractionData.contingencies?.appraisalDays ?? 'null'}`);
    console.log(`[extractor:fields] loanDays: ${extractionData.contingencies?.loanDays ?? 'null'}`);
    console.log(`[extractor:fields] saleOfBuyerProperty: ${extractionData.contingencies?.saleOfBuyerProperty ?? 'null'}`);
    console.log(`[extractor:fields] sellerCreditAmount: ${extractionData.closingCosts?.sellerCreditAmount ?? 'null'}`);
    console.log(`[extractor:fields] listingBrokerage: ${extractionData.brokers?.listingBrokerage ?? 'null'}`);
    console.log(`[extractor:fields] listingAgent: ${extractionData.brokers?.listingAgent ?? 'null'}`);
    console.log(`[extractor:fields] sellingBrokerage: ${extractionData.brokers?.sellingBrokerage ?? 'null'}`);
    console.log(`[extractor:fields] sellingAgent: ${extractionData.brokers?.sellingAgent ?? 'null'}`);
    console.log(`[extractor:fields] escrowHolder: ${extractionData.escrowHolder ?? 'null'}`);
    console.log(`${"─".repeat(80)}`);

    // Confidence and handwriting
    const confidence = parsed.confidence ?? {};
    const overallConfidence =
      typeof confidence.overall_confidence === 'number' ? confidence.overall_confidence : 95;

    const handwritingDetected = parsed.handwriting_detected === true;

    console.log(`\n[extractor:confidence] Overall confidence: ${overallConfidence}%`);
    console.log(`[extractor:confidence] Handwriting detected: ${handwritingDetected}`);
    
    if (confidence.overall_confidence !== undefined) {
      console.log(`[extractor:confidence] Individual field confidence:`);
      Object.entries(confidence).forEach(([field, value]) => {
        if (field !== 'overall_confidence') {
          console.log(`[extractor:confidence]   ${field}: ${value}%`);
        }
      });
    }

    // Determine review status
    const needsReview =
      overallConfidence < 80 ||
      (confidence.purchasePrice ?? 100) < 90 ||
      (confidence.buyerNames ?? 100) < 90 ||
      handwritingDetected;

    console.log(`\n[extractor:review] Needs review: ${needsReview}`);
    if (needsReview) {
      console.log(`[extractor:review] Reasons:`);
      if (overallConfidence < 80) console.log(`[extractor:review]   - Overall confidence < 80%`);
      if ((confidence.purchasePrice ?? 100) < 90) console.log(`[extractor:review]   - Purchase price confidence < 90%`);
      if ((confidence.buyerNames ?? 100) < 90) console.log(`[extractor:review]   - Buyer names confidence < 90%`);
      if (handwritingDetected) console.log(`[extractor:review]   - Handwriting detected`);
    }

    console.log(`\n${"═".repeat(80)}`);
    console.log(`║ ✅ EXTRACTION COMPLETE`);
    console.log(`${"═".repeat(80)}`);
    console.log(`   Confidence: ${overallConfidence}%`);
    console.log(`   Needs Review: ${needsReview}`);
    console.log(`   Buyers: ${extractionData.buyerNames?.length || 0}`);
    console.log(`   Sellers: ${extractionData.sellerNames?.length || 0}`);
    console.log(`   Property: ${extractionData.propertyAddress ? '✓' : '✗'}`);
    console.log(`   Price: ${extractionData.purchasePrice ? '✓' : '✗'}`);
    console.log(`${"═".repeat(80)}\n`);

    return {
      universal: extractionData,
      details: null,
      timelineEvents: [],
      needsReview,
    };
  } catch (error: any) {
    console.error(`[extractor:error] ❌ Unexpected error:`, error.message);
    console.error(`[extractor:error] Stack:`, error.stack);
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
  console.warn(`[extractor:fallback] ⚠️ Returning empty result with review flag`);
  return {
    universal: getEmptyUniversalResult(),
    details: null,
    timelineEvents: [] as TimelineEvent[],
    needsReview: true,
  };
}