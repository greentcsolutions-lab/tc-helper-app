// src/lib/extraction/extract/california/index.ts
// Version: 3.1.0 - 2025-12-23
// California extractor entry point — stubbed to safely force fallback to universal
// This prevents the "californiaExtractor is not a function" crash when router tries California route

import { LabeledCriticalImage } from '../../classify/classifier';
import { UniversalExtractionResult } from '../universal/types';

type TimelineEvent = {
  date: string;
  title: string;
  type: 'info' | 'warning' | 'critical';
  description?: string;
};

export async function californiaExtractor(
  criticalImages: LabeledCriticalImage[],
  packageMetadata: any
): Promise<{
  universal: UniversalExtractionResult;
  details: any;
  timelineEvents: TimelineEvent[];
  needsReview: boolean;
  route?: string;
}> {
  console.log('[californiaExtractor] California route triggered');
  console.log(`[californiaExtractor] ${criticalImages.length} critical pages received`);
  console.log('[californiaExtractor] Package metadata:', packageMetadata);

  // For now: intentionally fall back to universal behavior
  // This gives us a safe, crash-free path while we rebuild the full CA extractor
  const emptyUniversal: UniversalExtractionResult = {
    buyerNames: [],
    sellerNames: [],
    propertyAddress: '',
    purchasePrice: 0,
    earnestMoneyDeposit: { amount: null, holder: null },
    closingDate: null,
    effectiveDate: null,
    financing: {
      isAllCash: true,
      loanType: null,
      loanAmount: null,
    },
    contingencies: {
      inspectionDays: null,
      appraisalDays: null,
      loanDays: null,
      saleOfBuyerProperty: false,
    },
    closingCosts: {
      buyerPays: [],
      sellerPays: [],
      sellerCreditAmount: null,
    },
    brokers: {
      listingBrokerage: null,
      listingAgent: null,
      sellingBrokerage: null,
      sellingAgent: null,
    },
    personalPropertyIncluded: [],
    escrowHolder: null,
  };

  return {
    universal: emptyUniversal,
    details: {
      route: 'california',
      note: 'California extractor stubbed — forcing universal fallback for safety',
      detectedFormCodes: packageMetadata.detectedFormCodes || [],
    },
    timelineEvents: [],
    needsReview: true, // Always force review until full CA extractor is ready
    route: 'california-fallback-universal',
  };
}