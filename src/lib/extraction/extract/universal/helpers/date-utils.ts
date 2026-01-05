// src/lib/extraction/extract/universal/helpers/date-utils.ts
// Version: 2.0.0 - 2026-01-05
// ENHANCED: Full support for new closing object (specificDate / daysAfterAcceptance)
//          Computes closeOfEscrowDate with correct priority
//          Adds calculated contingency deadlines for UI use

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
          allDates.push({ date: dateStr.trim(), party, pageNumber: page.pageNumber, pageLabel: page.pageLabel });
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
    .filter(item => item.normalized !== null) as Array<{
      date: string;
      party: string;
      pageNumber: number;
      pageLabel: string;
      normalized: string;
    }>;
  
  if (normalizedDates.length === 0) {
    log.push('⚠️ No valid dates could be normalized');
    return null;
  }
  
  const latest = normalizedDates.sort((a, b) => 
    b.normalized.localeCompare(a.normalized)
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
    { regex: /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/, order: [2, 0, 1] }, // M/D/YY or M/D/YYYY
    { regex: /^(\d{1,2})-(\d{1,2})-(\d{2,4})$/, order: [2, 0, 1] },  // M-D-YY
    { regex: /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/, order: [0, 1, 2] }, // YYYY/M/D
    { regex: /^(\d{4})-(\d{1,2})-(\d{1,2})$/, order: [0, 1, 2] }, // YYYY-M-D
  ];
  
  for (const pattern of patterns) {
    const match = cleaned.match(pattern.regex);
    if (match) {
      let year = match[pattern.order[0] + 1];
      const month = match[pattern.order[1] + 1];
      const day = match[pattern.order[2] + 1];
      
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
    log.push('⚠️ No effective date found - skipping relative date normalization');
  } else {
    log.push(`📅 Using effective date ${acceptanceDate} for relative date calculations`);
  }

  const calculateDateFromDays = (days: number | string | null | undefined): string | null => {
    if (days == null) return null;
    const daysNum = typeof days === 'number' ? days : parseInt(days as string, 10);
    if (isNaN(daysNum)) return null;
    if (!acceptanceDate) return null;

    try {
      const baseDate = new Date(acceptanceDate);
      baseDate.setDate(baseDate.getDate() + daysNum);
      const year = baseDate.getFullYear();
      const month = String(baseDate.getMonth() + 1).padStart(2, '0');
      const day = String(baseDate.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch (e) {
      log.push(`⚠️ Failed to calculate date from ${daysNum} days after ${acceptanceDate}`);
      return null;
    }
  };

  // === PRIMARY: Handle new closing object with correct priority ===
  if (terms.closing) {
    const closing = terms.closing;

    if (closing.specificDate) {
      // Counter offer set a hard date — use it directly
      terms.closeOfEscrowDate = closing.specificDate;
      log.push(`✅ COE: Using specific calendar date from counter: ${closing.specificDate}`);
    } else if (closing.daysAfterAcceptance != null) {
      // Standard RPA: X days after acceptance
      const calculated = calculateDateFromDays(closing.daysAfterAcceptance);
      if (calculated) {
        terms.closeOfEscrowDate = calculated;
        log.push(`✅ COE: Calculated ${closing.daysAfterAcceptance} days after acceptance → ${calculated}`);
      } else {
        terms.closeOfEscrowDate = null;
        log.push(`⚠️ COE: Could not calculate from daysAfterAcceptance (missing effective date?)`);
      }
    } else {
      terms.closeOfEscrowDate = null;
      log.push(`⚠️ COE: No specificDate or daysAfterAcceptance provided`);
    }
  }

  // === LEGACY: Support old flat closingDate field (for backward compatibility) ===
  if (terms.closingDate != null && terms.closeOfEscrowDate == null) {
    if (typeof terms.closingDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(terms.closingDate.trim())) {
      terms.closeOfEscrowDate = terms.closingDate.trim();
      log.push(`📅 Legacy closingDate used as COE: ${terms.closeOfEscrowDate}`);
    } else {
      const calculated = calculateDateFromDays(terms.closingDate);
      if (calculated) {
        terms.closeOfEscrowDate = calculated;
        log.push(`📅 Legacy closingDate (${terms.closingDate} days) normalized → ${calculated}`);
      }
    }
  }

  // === CONTINGENCY DEADLINES (useful for UI timelines) ===
  if (terms.contingencies) {
    ['inspectionDays', 'appraisalDays', 'loanDays'].forEach(field => {
      if (terms.contingencies[field] != null) {
        const deadline = calculateDateFromDays(terms.contingencies[field]);
        if (deadline) {
          const deadlineField = `${field}Deadline` as const;
          terms.contingencies[deadlineField] = deadline;
          log.push(`📅 ${field} deadline: ${terms.contingencies[field]} days → ${deadline}`);
        }
      }
    });
  }

  return terms;
}