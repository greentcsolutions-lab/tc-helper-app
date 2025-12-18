// src/lib/extractor/field-locator.ts
// Version: 2.0.0 - 2025-01-09
// Field location metadata for 5-column table structure (RPA Pages 1-3)

export interface FieldLocation {
  page: number;           // RPA page number (1-17)
  section: string;        // e.g., "3.A", "3.D(1)", "L(9)"
  columns: number[];      // Which columns in 5-column table (1-5)
  description: string;
  required: boolean;
  confidenceThreshold: number;
  defaultValue?: any;
}

/**
 * CRITICAL FIELDS (95%+ confidence required)
 * These determine the entire transaction timeline
 */
export const CRITICAL_FIELDS: Record<string, FieldLocation> = {
  purchase_price: {
    page: 1,
    section: "3.A",
    columns: [2, 3, 4],  // Spans multiple columns in table
    description: "First row of table on RPA Page 1",
    required: true,
    confidenceThreshold: 95,
  },
  
  property_address: {
    page: 1,
    section: "1.B",
    columns: [1, 2, 3, 4, 5],  // Full-width field above table
    description: "Section 1.B, directly under buyer names",
    required: true,
    confidenceThreshold: 95,
  },

  close_of_escrow: {
    page: 1,
    section: "3.B",
    columns: [4],  // Column 4 contains the date/days
    description: "Can be 'X days after acceptance' or specific date MM/DD/YYYY",
    required: true,
    confidenceThreshold: 95,
  },

  final_acceptance_date: {
    page: 16,  // RPA signature page
    section: "Signature Block",
    columns: [1, 2, 3, 4, 5],
    description: "Latest signature date across RPA + all counter offers",
    required: true,
    confidenceThreshold: 95,
  },

  loan_contingency_days: {
    page: 2,
    section: "L(1)",
    columns: [4, 5],  // Column 4 has days, Column 5 has waiver checkbox
    description: "If checkbox in column 5 is checked, contingency is WAIVED",
    required: true,
    confidenceThreshold: 95,
    defaultValue: 17,
  },

  appraisal_contingency_days: {
    page: 2,
    section: "L(2)",
    columns: [4, 5],
    description: "If checkbox in column 5 is checked, contingency is WAIVED",
    required: true,
    confidenceThreshold: 95,
    defaultValue: 17,
  },

  investigation_contingency_days: {
    page: 2,
    section: "L(3)",
    columns: [4],
    description: "Appears as 'Investigation Contingency' on form",
    required: true,
    confidenceThreshold: 95,
    defaultValue: 17,
  },
};

/**
 * IMPORTANT FIELDS (85%+ confidence required)
 */
export const IMPORTANT_FIELDS: Record<string, FieldLocation> = {
  buyer_names: {
    page: 1,
    section: "1.A",
    columns: [1, 2, 3, 4, 5],
    description: "Top of RPA Page 1: 'THIS IS AN OFFER FROM [names]'",
    required: true,
    confidenceThreshold: 85,
  },

  all_cash: {
    page: 1,
    section: "3.A",
    columns: [5],  // Rightmost column, same row as purchase price
    description: "Checkbox in column 5 of purchase price row",
    required: false,
    confidenceThreshold: 85,
  },

  initial_deposit_amount: {
    page: 1,
    section: "3.D(1)",
    columns: [4],
    description: "Column 4 contains amount (can be $ or %)",
    required: true,
    confidenceThreshold: 85,
  },

  initial_deposit_due: {
    page: 1,
    section: "3.D(1)",
    columns: [5],
    description: "Column 5 contains due date (days or specific date)",
    required: true,
    confidenceThreshold: 85,
  },

  loan_type: {
    page: 2,
    section: "3.E(1)",
    columns: [5],
    description: "If all_cash is true, this is null",
    required: false,
    confidenceThreshold: 85,
    defaultValue: "Conventional",
  },

  cop_contingency: {
    page: 2,
    section: "L(9)",
    columns: [3, 5],  // Combined cell in columns 3+5
    description: "Contingency for Sale of Buyer's Property - checkbox near right of table",
    required: false,
    confidenceThreshold: 85,
  },
};

/**
 * OPTIONAL FIELDS (75%+ confidence required)
 */
export const OPTIONAL_FIELDS: Record<string, FieldLocation> = {
  seller_credit_to_buyer: {
    page: 2,
    section: "3.G(1)",
    columns: [3, 4],  // Checkbox in col 3, amount in col 4
    description: "If checkbox in column 3 is NOT checked, return null",
    required: false,
    confidenceThreshold: 75,
  },

  home_warranty_ordered_by: {
    page: 3,
    section: "3.Q(18)",
    columns: [4, 5],  // Combined cell
    description: "Who pays for warranty (Buyer/Seller/Both/Waived)",
    required: false,
    confidenceThreshold: 75,
  },

  home_warranty_seller_max_cost: {
    page: 3,
    section: "3.Q(18)",
    columns: [5],  // Right side of combined cell
    description: "Max amount seller will pay",
    required: false,
    confidenceThreshold: 75,
  },

  seller_delivery_of_documents_days: {
    page: 2,
    section: "N(1)",
    columns: [4],
    description: "Default is 7 days if not specified",
    required: false,
    confidenceThreshold: 75,
    defaultValue: 7,
  },

  crb_attached_and_signed: {
    page: 2,
    section: "L(8)",
    columns: [5],  // Very last column, multi-row span
    description: "Checkbox near row L(8) in column 5",
    required: false,
    confidenceThreshold: 75,
  },

  buyers_broker: {
    page: 17,
    section: "REAL ESTATE BROKERS",
    columns: [1, 2, 3, 4, 5],
    description: "Sometimes not filled out - return null if missing",
    required: false,
    confidenceThreshold: 75,
  },

  sellers_broker: {
    page: 17,
    section: "REAL ESTATE BROKERS",
    columns: [1, 2, 3, 4, 5],
    description: "Sometimes not filled out - return null if missing",
    required: false,
    confidenceThreshold: 75,
  },
};

/**
 * Get all fields grouped by priority
 */
export function getAllFields(): Record<string, FieldLocation> {
  return {
    ...CRITICAL_FIELDS,
    ...IMPORTANT_FIELDS,
    ...OPTIONAL_FIELDS,
  };
}

/**
 * Get minimum confidence threshold for a field
 */
export function getConfidenceThreshold(fieldName: string): number {
  const allFields = getAllFields();
  return allFields[fieldName]?.confidenceThreshold || 75;
}

/**
 * Check if field is required
 */
export function isFieldRequired(fieldName: string): boolean {
  const allFields = getAllFields();
  return allFields[fieldName]?.required || false;
}

/**
 * Get default value for field if not found
 */
export function getDefaultValue(fieldName: string): any {
  const allFields = getAllFields();
  return allFields[fieldName]?.defaultValue || null;
}