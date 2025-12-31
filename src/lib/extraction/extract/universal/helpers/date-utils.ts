// src/lib/extraction/extract/universal/helpers/date-utils.ts
// Version: 1.0.0 - 2025-12-31
// Date normalization and effective date calculation

import type { EnrichedPageExtraction } from '@/types/extraction';

export function calculateEffectiveDate(
  pageExtractions: EnrichedPageExtraction[],
  log: string[]
): string | null {
  const allDates: Array<{ date: string; party: string; pageNumber: number; pageLabel: string }> = [];
  
  // Collect all signature dates
  for (const page of pageExtractions) {
    const addDates = (dates: string[] | null | undefined, party: string) => {
      if (!dates || !Array.isArray(dates)) return;
      dates.forEach(dateStr => {
        if (dateStr && typeof dateStr === 'string') {
          allDates.push({ date: dateStr, party, pageNumber: page.pageNumber, pageLabel: page.pageLabel });
        }
      });
    };
    
    addDates(page.buyerSignatureDates, 'Buyer');
    addDates(page.sellerSignatureDates, 'Seller');
  }
  
  if (allDates.length === 0) {
    log.push('⚠️ No signature dates found on any pages');
    return null;
  }
  
  log.push(`📝 Found ${allDates.length} total signature dates across all pages`);
  
  // Normalize and find latest
  const normalizedDates = allDates
    .map(item => {
      const normalized = normalizeDateString(item.date);
      if (normalized) {
        log.push(`  ${item.party} signed ${item.date} on ${item.pageLabel} → ${normalized}`);
      }
      return { ...item, normalized };
    })
    .filter(item => item.normalized !== null);
  
  if (normalizedDates.length === 0) {
    log.push('⚠️ No valid dates could be normalized');
    return null;
  }
  
  const latest = normalizedDates.sort((a, b) => 
    (b.normalized || '').localeCompare(a.normalized || '')
  )[0];
  
  log.push(`✅ Latest signature: ${latest.party} on ${latest.normalized} (${latest.pageLabel})`);
  
  return latest.normalized;
}

export function normalizeDateString(dateStr: string): string | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  
  const cleaned = dateStr.trim();
  
  // Already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;
  
  // Try common patterns
  const patterns = [
    { regex: /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/, order: [2, 0, 1] }, // M/D/YY
    { regex: /^(\d{1,2})-(\d{1,2})-(\d{2,4})$/, order: [2, 0, 1] },  // M-D-YY
  ];
  
  for (const pattern of patterns) {
    const match = cleaned.match(pattern.regex);
    if (match) {
      let [, ...parts] = match;
      let year = parts[pattern.order[0]];
      const month = parts[pattern.order[1]];
      const day = parts[pattern.order[2]];
      
      // Handle 2-digit years
      if (year.length === 2) {
        const yearNum = parseInt(year, 10);
        year = yearNum <= 50 ? `20${year}` : `19${year}`;
      }
      
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }
  
  // Try JavaScript Date parsing as last resort
  try {
    const parsed = new Date(cleaned);
    if (!isNaN(parsed.getTime())) {
      const year = parsed.getFullYear();
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const day = String(parsed.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  } catch {
    // Parsing failed
  }
  
  return null;
}

export function normalizeDates(terms: Record<string, any>, log: string[]): Record<string, any> {
  const acceptanceDate = terms.effectiveDate;
  
  if (!acceptanceDate) {
    log.push('⚠️ No effective date found - cannot normalize relative dates');
    return terms;
  }
  
  const normalizeSingleDate = (value: number | string): number | string => {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    if (typeof value === 'string' && isNaN(Number(value))) return value;
    
    const days = typeof value === 'number' ? value : parseInt(value, 10);
    if (isNaN(days)) return value;
    
    try {
      const baseDate = new Date(acceptanceDate);
      baseDate.setDate(baseDate.getDate() + days);
      const year = baseDate.getFullYear();
      const month = String(baseDate.getMonth() + 1).padStart(2, '0');
      const day = String(baseDate.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch {
      return value;
    }
  };
  
  // Normalize closingDate
  if (terms.closingDate != null) {
    const normalized = normalizeSingleDate(terms.closingDate);
    if (normalized !== terms.closingDate) {
      log.push(`📅 closingDate normalized: ${terms.closingDate} → ${normalized}`);
      terms.closingDate = normalized;
    }
  }
  
  // Normalize contingencies
  if (terms.contingencies) {
    ['inspectionDays', 'appraisalDays', 'loanDays'].forEach(field => {
      if (terms.contingencies[field] != null) {
        const normalized = normalizeSingleDate(terms.contingencies[field]);
        if (normalized !== terms.contingencies[field]) {
          log.push(`📅 ${field} normalized: ${terms.contingencies[field]} → ${normalized}`);
          terms.contingencies[field] = normalized;
        }
      }
    });
  }
  
  return terms;
}