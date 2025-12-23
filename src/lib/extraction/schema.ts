// src/lib/extraction/schema.ts
// Version 1.0.0 2025-12-20
// NEW: Zod schema for extraction results validation
import { z } from "zod";

export const ExtractionSchema = z.object({
  extracted: z.object({
    buyer_names: z.array(z.string()).min(1),
    property_address: z.object({
      full: z.string().min(1),
    }),
    purchase_price: z.string().regex(/^\$\d{1,3}(,\d{3})*(\.\d{2})?$/),
    all_cash: z.boolean(),
    close_of_escrow: z.string(),
    initial_deposit: z.object({
      amount: z.string().regex(/^\$\d{1,3}(,\d{3})*(\.\d{2})?$/).or(z.string().regex(/^\d+%$/)),
      due: z.string(),
    }),
    loan_type: z.string().nullable(),
    loan_type_note: z.string().nullable(),
    seller_credit_to_buyer: z.string().nullable(),
    contingencies: z.object({
      loan_days: z.number().int().min(0),
      appraisal_days: z.number().int().min(0),
      investigation_days: z.number().int().min(0),
      crb_attached_and_signed: z.boolean(),
    }),
    cop_contingency: z.boolean(),
    seller_delivery_of_documents_days: z.number().int().min(0),
    home_warranty: z.object({
      ordered_by: z.enum(["Buyer", "Seller", "Both", "Waived"]).nullable(),
      seller_max_cost: z.string().nullable(),
      provider: z.string().nullable(),
    }),
    final_acceptance_date: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/),
    counters: z.object({
      has_counter_or_addendum: z.boolean(),
      counter_chain: z.array(z.string()),
      final_version_page: z.number().int().nullable(),
      summary: z.string(),
    }),
    buyers_broker: z.object({
      brokerage_name: z.string().nullable(),
      agent_name: z.string().nullable(),
      email: z.string().email().nullable(),
      phone: z.string().nullable(),
    }),
    sellers_broker: z.object({
      brokerage_name: z.string().nullable(),
      agent_name: z.string().nullable(),
      email: z.string().email().nullable(),
      phone: z.string().nullable(),
    }),
  }),
  confidence: z.object({
    overall_confidence: z.number().int().min(0).max(100),
    purchase_price: z.number().int().min(0).max(100),
    property_address: z.number().int().min(0).max(100),
    buyer_names: z.number().int().min(0).max(100),
    close_of_escrow: z.number().int().min(0).max(100),
    final_acceptance_date: z.number().int().min(0).max(100),
    contingencies: z.number().int().min(0).max(100),
    home_warranty: z.number().int().min(0).max(100),
    brokerage_info: z.number().int().min(0).max(100),
    loan_type: z.number().int().min(0).max(100),
  }),
  handwriting_detected: z.boolean(),
});