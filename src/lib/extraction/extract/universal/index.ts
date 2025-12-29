// src/lib/extraction/extract/universal/index.ts
// Version: 4.0.0 - 2025-12-29
// ENHANCED: Confidence thresholding + field provenance tracking
// NEW: Explicit handling of missing confidence scores → force review
// NEW: Track which page contributed which field for debugging
// BREAKING: purchasePrice: 0 now triggers second-turn retry

import { LabeledCriticalImage } from '@/types/classification';
import { UniversalExtractionResult } from '@/types/extraction';
import { UNIVERSAL_EXTRACTOR_PROMPT } from '../../prompts';

type TimelineEvent = {
  date: string;
  title: string;
  type: 'info' | 'warning' | 'critical';
  description?: string;
};

type FieldProvenance = {
  field: string;
  pageNumber: number;
  pageLabel: string;
  confidence: number;
  value: any;
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
  details: {
    fieldProvenance: FieldProvenance[];
    confidenceBreakdown: Record<string, number>;
    missingConfidenceFields: string[];
  } | null;
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
  console.log(`[extractor:prompt] Sending ${criticalImages.length} high-DPI images to Grok`);

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
    console.log(`[extractor:response] First 500 chars:`, content.slice(0, 500));

    // Extract JSON
    const jsonMatch = content.match(/{[\s\S]*}/);
    if (!jsonMatch) {
      console.error(`[extractor:parse] ❌ NO JSON BLOCK FOUND`);
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
      return fallbackResult();
    }

    // Flexible extraction (bare object OR wrapped in "extracted")
    let extractionData: UniversalExtractionResult;

    if (parsed.extracted) {
      console.log(`[extractor:structure] Response wrapped in "extracted" key`);
      extractionData = parsed.extracted;
    } else if (parsed.buyerNames !== undefined || parsed.purchasePrice !== undefined) {
      console.log(`[extractor:structure] Bare object response – using directly`);
      extractionData = parsed as UniversalExtractionResult;
    } else {
      console.warn(`[extractor:structure] ⚠️ No recognizable data structure → forcing review`);
      return fallbackResult();
    }

    // ═══════════════════════════════════════════════════════════════════════
    // CONFIDENCE ANALYSIS + FIELD PROVENANCE
    // ═══════════════════════════════════════════════════════════════════════

    const confidence = parsed.confidence ?? {};
    
    // CRITICAL: Missing confidence scores = LOW confidence (not 95%)
    const overallConfidence = 
      typeof confidence.overall_confidence === 'number' 
        ? confidence.overall_confidence 
        : 50; // Force review if Grok didn't provide confidence

    console.log(`\n[extractor:confidence] === CONFIDENCE BREAKDOWN ===`);
    console.log(`[extractor:confidence] Overall: ${overallConfidence}%`);

    // Track which fields are missing confidence scores
    const criticalFields = [
      'purchasePrice',
      'buyerNames',
      'propertyAddress',
      'closingDate',
      'financing',
      'brokers',
    ];

    const missingConfidenceFields = criticalFields.filter(
      field => confidence[field] === undefined
    );

    if (missingConfidenceFields.length > 0) {
      console.warn(`[extractor:confidence] ⚠️ Missing confidence for: [${missingConfidenceFields.join(', ')}]`);
    }

    // Log individual field confidence
    Object.entries(confidence).forEach(([field, value]) => {
      if (field !== 'overall_confidence' && typeof value === 'number') {
        console.log(`[extractor:confidence]   ${field}: ${value}%`);
      }
    });

    // Build field provenance map (which page contributed which field)
    const fieldProvenance: FieldProvenance[] = buildFieldProvenance(
      extractionData,
      criticalImages,
      confidence
    );

    console.log(`\n[extractor:provenance] === FIELD PROVENANCE ===`);
    fieldProvenance.forEach(fp => {
      console.log(`[extractor:provenance] ${fp.field}: Page ${fp.pageNumber} (${fp.confidence}%) = ${JSON.stringify(fp.value)?.substring(0, 50)}`);
    });

    // Handwriting detection
    const handwritingDetected = parsed.handwriting_detected === true;
    console.log(`[extractor:confidence] Handwriting detected: ${handwritingDetected}`);

    // ═══════════════════════════════════════════════════════════════════════
    // CRITICAL FIELD VALIDATION (Issue 4: purchasePrice = 0 triggers review)
    // ═══════════════════════════════════════════════════════════════════════

    const criticalFieldIssues: string[] = [];

    // Purchase price must be > 0 (if 0, Grok failed extraction)
    if (extractionData.purchasePrice === 0) {
      criticalFieldIssues.push('purchasePrice is 0 (extraction failed)');
    }

    // Buyer names must exist
    if (!extractionData.buyerNames || extractionData.buyerNames.length === 0) {
      criticalFieldIssues.push('buyerNames is empty');
    }

    // Property address must exist
    if (!extractionData.propertyAddress || extractionData.propertyAddress.trim() === '') {
      criticalFieldIssues.push('propertyAddress is empty');
    }

    if (criticalFieldIssues.length > 0) {
      console.error(`[extractor:validation] ❌ Critical field issues:`);
      criticalFieldIssues.forEach(issue => console.error(`[extractor:validation]   - ${issue}`));
    }

    // ═══════════════════════════════════════════════════════════════════════
    // NEEDS REVIEW LOGIC
    // ═══════════════════════════════════════════════════════════════════════

    const needsReview =
      overallConfidence < 80 ||
      (confidence.purchasePrice ?? 50) < 90 || // Default to 50 if missing
      (confidence.buyerNames ?? 50) < 90 ||
      (confidence.propertyAddress ?? 50) < 85 ||
      missingConfidenceFields.length > 0 ||
      criticalFieldIssues.length > 0 ||
      handwritingDetected;

    console.log(`\n[extractor:review] === REVIEW DECISION ===`);
    console.log(`[extractor:review] Needs review: ${needsReview}`);
    if (needsReview) {
      console.log(`[extractor:review] Reasons:`);
      if (overallConfidence < 80) console.log(`[extractor:review]   - Overall confidence < 80% (${overallConfidence}%)`);
      if ((confidence.purchasePrice ?? 50) < 90) console.log(`[extractor:review]   - Purchase price confidence < 90%`);
      if ((confidence.buyerNames ?? 50) < 90) console.log(`[extractor:review]   - Buyer names confidence < 90%`);
      if ((confidence.propertyAddress ?? 50) < 85) console.log(`[extractor:review]   - Property address confidence < 85%`);
      if (missingConfidenceFields.length > 0) console.log(`[extractor:review]   - Missing confidence for: [${missingConfidenceFields.join(', ')}]`);
      if (criticalFieldIssues.length > 0) console.log(`[extractor:review]   - Critical field issues: ${criticalFieldIssues.join(', ')}`);
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
      details: {
        fieldProvenance,
        confidenceBreakdown: confidence,
        missingConfidenceFields,
      },
      timelineEvents: [],
      needsReview,
    };
  } catch (error: any) {
    console.error(`[extractor:error] ❌ Unexpected error:`, error.message);
    console.error(`[extractor:error] Stack:`, error.stack);
    return fallbackResult();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Build field provenance map
// ═══════════════════════════════════════════════════════════════════════════

function buildFieldProvenance(
  extracted: UniversalExtractionResult,
  criticalImages: LabeledCriticalImage[],
  confidence: Record<string, number>
): FieldProvenance[] {
  const provenance: FieldProvenance[] = [];

  // Map fields to likely page sources based on labels
  const fieldToPageMapping: Record<string, RegExp[]> = {
    purchasePrice: [/PRICE|TERMS|PAGE 1/i],
    buyerNames: [/BUYER|PAGE 1|TERMS/i],
    sellerNames: [/SELLER|PAGE 1|TERMS/i],
    propertyAddress: [/ADDRESS|PAGE 1|TERMS/i],
    closingDate: [/CLOSING|ESCROW|PAGE 1|PAGE 2/i],
    earnestMoneyDeposit: [/DEPOSIT|EARNEST|PAGE 1|TERMS/i],
    financing: [/FINANCING|LOAN|PAGE 1|TERMS/i],
    contingencies: [/CONTINGENC|PAGE 2/i],
    brokers: [/BROKER|AGENT|PAGE 17|LAST PAGE/i],
  };

  for (const [fieldName, patterns] of Object.entries(fieldToPageMapping)) {
    // Find the page that likely contains this field
    const matchingImage = criticalImages.find(img => 
      patterns.some(pattern => pattern.test(img.label))
    );

    if (matchingImage) {
      const fieldValue = (extracted as any)[fieldName];
      const fieldConfidence = confidence[fieldName] ?? 50;

      provenance.push({
        field: fieldName,
        pageNumber: matchingImage.pageNumber,
        pageLabel: matchingImage.label,
        confidence: fieldConfidence,
        value: fieldValue,
      });
    }
  }

  return provenance;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Empty result + fallback
// ═══════════════════════════════════════════════════════════════════════════

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