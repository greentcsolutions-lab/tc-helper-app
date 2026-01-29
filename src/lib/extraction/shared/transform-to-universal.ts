// src/lib/extraction/shared/transform-to-universal.ts
// Version: 2.0.0 - 2026-01-29
// ENHANCED: Added closing cost allocation transformation with seller credit extraction
// Shared transformation logic used by ALL AI providers
// Converts extracted data to UniversalExtractionResult format

import { coerceNumber, coerceString } from '@/lib/grok/type-coercion';
import { normalizeDateString } from '@/lib/extraction/extract/universal/helpers/date-utils';
import type { ClosingCostItem } from '@/types/extraction';

/**
 * Transform extracted data from any AI provider to universal format
 * This handles the structured timeline data and maintains backwards compatibility
 */
export function transformToUniversal(data: any): any {
  const e = data.extracted;

  const effectiveDate = normalizeDateString(e.final_acceptance_date) || e.final_acceptance_date;
  const purchasePrice = coerceNumber(e.purchase_price);

  console.log(`[transform] Coerced purchasePrice: "${e.purchase_price}" → ${purchasePrice}`);
  console.log(`[transform] Normalized effectiveDate: "${e.final_acceptance_date}" → ${effectiveDate}`);

  // Transform timeline events to our structured format
  const timelineEventsStructured: Record<string, any> = {};

  if (e.timeline_events && Array.isArray(e.timeline_events)) {
    console.log(`[transform] Processing ${e.timeline_events.length} timeline events`);

    for (const event of e.timeline_events) {
      const eventData: any = {
        dateType: event.date_type,
        effectiveDate: null, // Will be calculated later
      };

      if (event.date_type === 'specified' && event.specified_date) {
        eventData.specifiedDate = normalizeDateString(event.specified_date) || event.specified_date;
      } else if (event.date_type === 'relative') {
        eventData.relativeDays = event.relative_days;
        eventData.anchorPoint = event.anchor_point || 'acceptance';
        eventData.direction = event.direction || 'after';
        eventData.dayType = event.day_type || 'calendar';
      }

      if (event.display_name) {
        eventData.displayName = event.display_name;
      }

      if (event.description) {
        eventData.description = event.description;
      }

      timelineEventsStructured[event.event_key] = eventData;

      console.log(`[transform] Timeline event "${event.event_key}": ${event.date_type}`, eventData);
    }
  }

  // ============================================================================
  // NEW: Transform closing cost allocations
  // ============================================================================
  const closingCostAllocations: ClosingCostItem[] = [];
  let sellerCreditAmount: number | null = null;

  if (e.closing_cost_allocations && Array.isArray(e.closing_cost_allocations)) {
    console.log(`[transform] Processing ${e.closing_cost_allocations.length} closing cost allocations`);

    for (const item of e.closing_cost_allocations) {
      const costItem: ClosingCostItem = {
        itemName: item.item_name || 'Unknown Item',
        paidBy: item.paid_by || 'Not specified',
        amount: coerceNumber(item.amount),
        notes: coerceString(item.notes),
      };

      closingCostAllocations.push(costItem);

      // Extract seller credit/concession/assist/contribution amount
      // Look for common variations in the item name
      const itemNameLower = costItem.itemName.toLowerCase();
      const isSellerCredit = (
        itemNameLower.includes('seller credit') ||
        itemNameLower.includes('seller concession') ||
        itemNameLower.includes('seller assist') ||
        itemNameLower.includes('seller contribution') ||
        itemNameLower.includes('seller-paid closing')
      );

      if (isSellerCredit && costItem.amount !== null) {
        console.log(`[transform] Found seller credit: ${costItem.itemName} = $${costItem.amount}`);
        // Use the largest seller credit amount if multiple found
        if (sellerCreditAmount === null || costItem.amount > sellerCreditAmount) {
          sellerCreditAmount = costItem.amount;
        }
      }

      console.log(`[transform] Closing cost: "${costItem.itemName}" paid by ${costItem.paidBy}${costItem.amount ? ` ($${costItem.amount})` : ''}`);
    }
  }

  // Fallback: Check for seller_credit_to_buyer field (legacy extraction)
  if (sellerCreditAmount === null && e.seller_credit_to_buyer) {
    const legacyCredit = coerceNumber(e.seller_credit_to_buyer);
    if (legacyCredit !== null) {
      console.log(`[transform] Using legacy seller_credit_to_buyer: $${legacyCredit}`);
      sellerCreditAmount = legacyCredit;
    }
  }

  // For backwards compatibility, extract specific fields from timeline events
  let closeOfEscrowDate = null;
  let initialDepositDueDate = null;
  let sellerDeliveryOfDisclosuresDate = null;
  let contingencies = null;

  // Extract closing date
  if (timelineEventsStructured.closing) {
    if (timelineEventsStructured.closing.dateType === 'specified') {
      closeOfEscrowDate = timelineEventsStructured.closing.specifiedDate;
    } else {
      closeOfEscrowDate = `${timelineEventsStructured.closing.relativeDays} days after ${timelineEventsStructured.closing.anchorPoint}`;
    }
  }

  // Extract initial deposit
  if (timelineEventsStructured.initialDeposit) {
    if (timelineEventsStructured.initialDeposit.dateType === 'specified') {
      initialDepositDueDate = timelineEventsStructured.initialDeposit.specifiedDate;
    } else {
      initialDepositDueDate = `${timelineEventsStructured.initialDeposit.relativeDays} days`;
    }
  }

  // Extract seller disclosures
  if (timelineEventsStructured.sellerDisclosures) {
    if (timelineEventsStructured.sellerDisclosures.dateType === 'specified') {
      sellerDeliveryOfDisclosuresDate = timelineEventsStructured.sellerDisclosures.specifiedDate;
    } else {
      sellerDeliveryOfDisclosuresDate = `${timelineEventsStructured.sellerDisclosures.relativeDays} days`;
    }
  }

  // Extract contingencies from timeline events
  const inspectionDays = timelineEventsStructured.inspectionContingency?.relativeDays || null;
  const appraisalDays = timelineEventsStructured.appraisalContingency?.relativeDays || null;
  const loanDays = timelineEventsStructured.loanContingency?.relativeDays || null;

  if (inspectionDays || appraisalDays || loanDays) {
    contingencies = {
      inspectionDays,
      appraisalDays,
      loanDays,
      saleOfBuyerProperty: e.cop_contingency || false,
    };
  }

  // Find initial deposit amount from timeline events
  let earnestMoneyAmount = null;
  if (timelineEventsStructured.initialDeposit?.description) {
    const amountMatch = timelineEventsStructured.initialDeposit.description.match(/\$[\d,]+(?:\.\d{2})?/);
    if (amountMatch) {
      earnestMoneyAmount = coerceNumber(amountMatch[0]);
    }
  }

  return {
    buyerNames: e.buyer_names || [],
    sellerNames: [],
    propertyAddress: coerceString(e.property_address?.full),
    purchasePrice,
    closeOfEscrowDate,
    effectiveDate,
    initialDepositDueDate,
    sellerDeliveryOfDisclosuresDate,

    // NEW: Structured timeline data
    timelineDataStructured: timelineEventsStructured,

    earnestMoneyDeposit: earnestMoneyAmount ? {
      amount: earnestMoneyAmount,
      holder: null,
    } : null,

    financing: {
      isAllCash: e.all_cash,
      loanType: coerceString(e.loan_type),
      loanAmount: null,
    },

    contingencies,

    // ENHANCED: Closing costs with detailed allocations
    closingCosts: {
      allocations: closingCostAllocations,           // NEW
      sellerCreditAmount,                            // Updated to use extracted value
      buyerPays: [],                                 // DEPRECATED but kept for compatibility
      sellerPays: [],                                // DEPRECATED but kept for compatibility
    },

    brokers: {
      listingBrokerage: coerceString(e.sellers_broker?.brokerage_name),
      listingAgent: coerceString(e.sellers_broker?.agent_name),
      listingAgentEmail: coerceString(e.sellers_broker?.email),
      listingAgentPhone: coerceString(e.sellers_broker?.phone),
      sellingBrokerage: coerceString(e.buyers_broker?.brokerage_name),
      sellingAgent: coerceString(e.buyers_broker?.agent_name),
      sellingAgentEmail: coerceString(e.buyers_broker?.email),
      sellingAgentPhone: coerceString(e.buyers_broker?.phone),
    },

    personalPropertyIncluded: null,
    escrowHolder: null,

    confidence: data.confidence,
    handwritingDetected: data.handwriting_detected,
    counters: e.counters,
  };
}
