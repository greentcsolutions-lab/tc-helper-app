// src/lib/extraction/extract/universal/helpers/type-coercion.ts
// Version: 1.0.0 - 2025-12-31
// Configuration-driven type coercion for extraction results

import {
  coerceNumber,
  coerceString,
  coerceStringArray,
  coerceBoolean,
  trackCoercion,
} from '@/lib/grok/type-coercion';

type CoercionConfig = {
  path: string;
  coercer: (value: any) => any;
};

function applyCoercion(
  obj: Record<string, any>,
  config: CoercionConfig,
  log: string[]
): number {
  const pathParts = config.path.split('.');
  let target = obj;
  
  // Navigate to parent object
  for (let i = 0; i < pathParts.length - 1; i++) {
    if (!target[pathParts[i]]) return 0;
    target = target[pathParts[i]];
  }
  
  const finalKey = pathParts[pathParts.length - 1];
  const result = trackCoercion(target[finalKey], config.coercer(target[finalKey]), config.path);
  
  if (result.changed) {
    log.push(result.log!);
    target[finalKey] = result.value;
    return 1;
  }
  
  return 0;
}

export function coerceAllTypes(terms: Record<string, any>, log: string[]): Record<string, any> {
  console.log(`\n[coercion] ${"─".repeat(60)}`);
  console.log(`[coercion] COERCING TYPES (using grok/type-coercion)`);
  console.log(`[coercion] ${"─".repeat(60)}`);
  
  const coerced: Record<string, any> = { ...terms };
  
  // Configuration-driven coercion
  const coercions: CoercionConfig[] = [
    // Scalars
    { path: 'buyerNames', coercer: coerceStringArray },
    { path: 'sellerNames', coercer: coerceStringArray },
    { path: 'propertyAddress', coercer: coerceString },
    { path: 'purchasePrice', coercer: (v) => coerceNumber(v, 0) },
    { path: 'personalPropertyIncluded', coercer: coerceStringArray },
    { path: 'escrowHolder', coercer: coerceString },
    
    // Earnest Money
    { path: 'earnestMoneyDeposit.amount', coercer: coerceNumber },
    { path: 'earnestMoneyDeposit.holder', coercer: coerceString },
    
    // Financing
    { path: 'financing.isAllCash', coercer: coerceBoolean },
    { path: 'financing.loanType', coercer: coerceString },
    { path: 'financing.loanAmount', coercer: coerceNumber },
    
    // Contingencies
    { path: 'contingencies.inspectionDays', coercer: coerceNumber },
    { path: 'contingencies.appraisalDays', coercer: coerceNumber },
    { path: 'contingencies.loanDays', coercer: coerceNumber },
    { path: 'contingencies.saleOfBuyerProperty', coercer: coerceBoolean },
    
    // Closing Costs
    { path: 'closingCosts.buyerPays', coercer: coerceStringArray },
    { path: 'closingCosts.sellerPays', coercer: coerceStringArray },
    { path: 'closingCosts.sellerCreditAmount', coercer: coerceNumber },
    
    // Brokers
    { path: 'brokers.listingBrokerage', coercer: coerceString },
    { path: 'brokers.listingAgent', coercer: coerceString },
    { path: 'brokers.sellingBrokerage', coercer: coerceString },
    { path: 'brokers.sellingAgent', coercer: coerceString },
  ];
  
  const coercionCount = coercions.reduce(
    (count, config) => count + applyCoercion(coerced, config, log),
    0
  );
  
  console.log(`[coercion] ${coercionCount > 0 ? '⚠️' : '✅'} Applied ${coercionCount} type coercions`);
  console.log(`[coercion] ${"─".repeat(60)}\n`);
  
  return coerced;
}