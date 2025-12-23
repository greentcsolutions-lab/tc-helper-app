// src/lib/extractor/extractor.ts
// Version: 3.0.0 - 2025-12-20
// UPDATED: No Zod — direct validation against the new flat real-estate-offer.schema.json (v2.1.0)
//          Returns clean, normalized extraction matching the exact schema

import OpenAI from "openai";
import { EXTRACTOR_PROMPT, SECOND_TURN_PROMPT } from "@lib/extraction/prompts";

interface LabeledImage {
  pageNumber: number;
  base64: string;
  label: string;
}

// The exact shape of the new schema
export interface ExtractionResult {
  buyerNames: string[]; // 1-4 strings
  propertyAddress: string;
  purchasePrice: number;
  allCashOffer: boolean;
  initialDepositAmount: number;
  loanType: "Conventional" | "FHA" | "VA" | "n/a";
  sellerCreditToBuyer: number | "None";
  countersAndAddendaSummary: string | null;
  homeWarrantyOrderedBy: "Seller" | "Buyer" | "Both" | "Waived";
  sellerMaxWarrantyCost: string | null; // defaults to "Not Specified"
  homeWarrantyProvider: string | null;
  copContingency: boolean;
  finalAcceptanceDate: string | null; // YYYY-MM-DD
  initialDepositDue: number; // default 3
  sellerDeliveryOfDocuments: number; // default 7
  crbAttachedAndSigned: "Yes" | "No";
  inspectionContingency: number | string | "Waived"; // days, YYYY-MM-DD, or "Waived"
  appraisalContingency: number | string | "Waived";
  loanContingency: number | string | "Waived";
  closeOfEscrow: number | string; // days or YYYY-MM-DD
  buyersBrokerage: string;
  buyersAgent: string;
  buyersAgentEmail?: string;
  buyersAgentPhone?: string;
  sellersBrokerage: string;
  listingAgent: string;
  listingAgentEmail?: string;
  listingAgentPhone?: string;
}

const client = new OpenAI({
  apiKey: process.env.XAI_API_KEY!,
  baseURL: "https://api.x.ai/v1",
});

// Simple runtime validation against the schema (no Zod)
function validateExtraction(data: any): { valid: true; result: ExtractionResult } | { valid: false; errors: string[] } {
  const errors: string[] = [];

  // Required top-level fields
  if (!Array.isArray(data.buyerNames) || data.buyerNames.length < 1 || data.buyerNames.length > 4 || data.buyerNames.some((n: any) => typeof n !== "string" || n.trim() === "")) {
    errors.push("buyerNames must be an array of 1-4 non-empty strings");
  }

  if (typeof data.propertyAddress !== "string" || data.propertyAddress.trim() === "") {
    errors.push("propertyAddress must be a non-empty string");
  }

  if (typeof data.purchasePrice !== "number" || data.purchasePrice < 0) {
    errors.push("purchasePrice must be a non-negative number");
  }

  if (typeof data.allCashOffer !== "boolean") {
    errors.push("allCashOffer must be boolean");
  }

  if (typeof data.initialDepositAmount !== "number" || data.initialDepositAmount < 0) {
    errors.push("initialDepositAmount must be a non-negative number");
  }

  if (!["Conventional", "FHA", "VA", "n/a"].includes(data.loanType)) {
    errors.push("loanType must be one of: Conventional, FHA, VA, n/a");
  }

  if (!(typeof data.sellerCreditToBuyer === "number" && data.sellerCreditToBuyer >= 0) && data.sellerCreditToBuyer !== "None") {
    errors.push("sellerCreditToBuyer must be a non-negative number or 'None'");
  }

  if (!["Seller", "Buyer", "Both", "Waived"].includes(data.homeWarrantyOrderedBy)) {
    errors.push("homeWarrantyOrderedBy must be Seller, Buyer, Both, or Waived");
  }

  if (typeof data.copContingency !== "boolean") {
    errors.push("copContingency must be boolean");
  }

  if (!["Yes", "No"].includes(data.crbAttachedAndSigned)) {
    errors.push("crbAttachedAndSigned must be 'Yes' or 'No'");
  }

  if (typeof data.closeOfEscrow !== "number" && (typeof data.closeOfEscrow !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data.closeOfEscrow))) {
    errors.push("closeOfEscrow must be a number (days) or YYYY-MM-DD date string");
  }

  // Optional but typed fields
  if (data.countersAndAddendaSummary !== null && typeof data.countersAndAddendaSummary !== "string") {
    errors.push("countersAndAddendaSummary must be string or null");
  }

  if (data.finalAcceptanceDate !== null && (typeof data.finalAcceptanceDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data.finalAcceptanceDate))) {
    errors.push("finalAcceptanceDate must be null or YYYY-MM-DD");
  }

  if (data.sellerMaxWarrantyCost !== null && typeof data.sellerMaxWarrantyCost !== "string") {
    errors.push("sellerMaxWarrantyCost must be string or null");
  }

  if (data.homeWarrantyProvider !== null && typeof data.homeWarrantyProvider !== "string") {
    errors.push("homeWarrantyProvider must be string or null");
  }

  // Contingency fields
  const validateContingency = (field: any, name: string) => {
    const isNum = typeof field === "number" && field >= 0 && Number.isInteger(field);
    const isDate = typeof field === "string" && /^\d{4}-\d{2}-\d{2}$/.test(field);
    const isWaived = field === "Waived";
    if (!(isNum || isDate || isWaived)) {
      errors.push(`${name} must be integer days, YYYY-MM-DD date, or 'Waived'`);
    }
  };

  validateContingency(data.inspectionContingency, "inspectionContingency");
  validateContingency(data.appraisalContingency, "appraisalContingency");
  validateContingency(data.loanContingency, "loanContingency");

  // Broker/agent required fields
  if (typeof data.buyersBrokerage !== "string") errors.push("buyersBrokerage required");
  if (typeof data.buyersAgent !== "string") errors.push("buyersAgent required");
  if (typeof data.sellersBrokerage !== "string") errors.push("sellersBrokerage required");
  if (typeof data.listingAgent !== "string") errors.push("listingAgent required");

  // Optional email/phone validation
  if (data.buyersAgentEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.buyersAgentEmail)) {
    errors.push("buyersAgentEmail invalid format");
  }
  if (data.buyersAgentPhone && !/^\(\d{3}\) \d{3}-\d{4}$/.test(data.buyersAgentPhone)) {
    errors.push("buyersAgentPhone must match (XXX) XXX-XXXX");
  }
  if (data.listingAgentEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.listingAgentEmail)) {
    errors.push("listingAgentEmail invalid format");
  }
  if (data.listingAgentPhone && !/^\(\d{3}\) \d{3}-\d{4}$/.test(data.listingAgentPhone)) {
    errors.push("listingAgentPhone must match (XXX) XXX-XXXX");
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, result: data as ExtractionResult };
}

export async function extractFromCriticalPages(
  images: LabeledImage[],
  previousResult?: ExtractionResult
): Promise<{
  data: ExtractionResult;
  raw?: any;
  needsReview: boolean;
}> {
  if (images.length === 0) {
    throw new Error("No images provided for extraction");
  }

  let promptText = EXTRACTOR_PROMPT;
  if (previousResult) {
    promptText = SECOND_TURN_PROMPT.replace("{{PREVIOUS_JSON}}", JSON.stringify(previousResult, null, 2));
  }

  const content = [
    { type: "text" as const, text: promptText },
    ...images.flatMap((img) => [
      {
        type: "text" as const,
        text: `\n━━━ ${img.label} ━━━\nCarefully read all filled fields. Apply changes from counters/addenda only where explicitly stated.`,
      },
      { type: "image_url" as const, image_url: { url: img.base64 } },
    ]),
  ];

  console.log(`[extractor] Sending ${images.length} critical pages to Grok for final extraction`);

  const response = await client.chat.completions.create({
    model: "grok-4-1-fast-reasoning",
    temperature: 0,
    max_tokens: 4096,
    messages: [{ role: "user", content }],
    response_format: { type: "json_object" },
  });

  const rawContent = response.choices[0].message.content?.trim();
  if (!rawContent) {
    throw new Error("Empty response from Grok");
  }

  let parsed: any;
  try {
    parsed = JSON.parse(rawContent);
  } catch (e) {
    console.error("[extractor] Failed to parse JSON:", rawContent.substring(0, 1000));
    throw new Error("Model returned invalid JSON");
  }

  const validation = validateExtraction(parsed);

  if (!validation.valid) {
    console.error("[extractor] Schema validation failed:");
    validation.errors.forEach(err => console.error(`  • ${err}`));
    console.log("[extractor] Raw output (truncated):", JSON.stringify(parsed, null, 2).substring(0, 1500));

    // Return best-effort partial data with flag
    const fallback: ExtractionResult = {
      buyerNames: Array.isArray(parsed.buyerNames) ? parsed.buyerNames.slice(0, 4).filter((n: any) => typeof n === "string") : ["UNKNOWN"],
      propertyAddress: typeof parsed.propertyAddress === "string" ? parsed.propertyAddress : "UNKNOWN ADDRESS",
      purchasePrice: typeof parsed.purchasePrice === "number" ? parsed.purchasePrice : 0,
      allCashOffer: typeof parsed.allCashOffer === "boolean" ? parsed.allCashOffer : false,
      initialDepositAmount: typeof parsed.initialDepositAmount === "number" ? parsed.initialDepositAmount : 0,
      loanType: ["Conventional", "FHA", "VA", "n/a"].includes(parsed.loanType) ? parsed.loanType : "Conventional",
      sellerCreditToBuyer: typeof parsed.sellerCreditToBuyer === "number" ? parsed.sellerCreditToBuyer : "None",
      countersAndAddendaSummary: typeof parsed.countersAndAddendaSummary === "string" ? parsed.countersAndAddendaSummary : null,
      homeWarrantyOrderedBy: ["Seller", "Buyer", "Both", "Waived"].includes(parsed.homeWarrantyOrderedBy) ? parsed.homeWarrantyOrderedBy : "Buyer",
      sellerMaxWarrantyCost: typeof parsed.sellerMaxWarrantyCost === "string" ? parsed.sellerMaxWarrantyCost : "Not Specified",
      homeWarrantyProvider: typeof parsed.homeWarrantyProvider === "string" ? parsed.homeWarrantyProvider : null,
      copContingency: typeof parsed.copContingency === "boolean" ? parsed.copContingency : false,
      finalAcceptanceDate: typeof parsed.finalAcceptanceDate === "string" ? parsed.finalAcceptanceDate : null,
      initialDepositDue: typeof parsed.initialDepositDue === "number" ? parsed.initialDepositDue : 3,
      sellerDeliveryOfDocuments: typeof parsed.sellerDeliveryOfDocuments === "number" ? parsed.sellerDeliveryOfDocuments : 7,
      crbAttachedAndSigned: ["Yes", "No"].includes(parsed.crbAttachedAndSigned) ? parsed.crbAttachedAndSigned : "No",
      inspectionContingency: typeof parsed.inspectionContingency === "number" || typeof parsed.inspectionContingency === "string" ? parsed.inspectionContingency : 17,
      appraisalContingency: typeof parsed.appraisalContingency === "number" || typeof parsed.appraisalContingency === "string" ? parsed.appraisalContingency : 17,
      loanContingency: typeof parsed.loanContingency === "number" || typeof parsed.loanContingency === "string" ? parsed.loanContingency : 17,
      closeOfEscrow: typeof parsed.closeOfEscrow === "number" || typeof parsed.closeOfEscrow === "string" ? parsed.closeOfEscrow : 30,
      buyersBrokerage: typeof parsed.buyersBrokerage === "string" ? parsed.buyersBrokerage : "",
      buyersAgent: typeof parsed.buyersAgent === "string" ? parsed.buyersAgent : "",
      buyersAgentEmail: typeof parsed.buyersAgentEmail === "string" ? parsed.buyersAgentEmail : undefined,
      buyersAgentPhone: typeof parsed.buyersAgentPhone === "string" ? parsed.buyersAgentPhone : undefined,
      sellersBrokerage: typeof parsed.sellersBrokerage === "string" ? parsed.sellersBrokerage : "",
      listingAgent: typeof parsed.listingAgent === "string" ? parsed.listingAgent : "",
      listingAgentEmail: typeof parsed.listingAgentEmail === "string" ? parsed.listingAgentEmail : undefined,
      listingAgentPhone: typeof parsed.listingAgentPhone === "string" ? parsed.listingAgentPhone : undefined,
    };

    return {
      data: fallback,
      raw: parsed,
      needsReview: true,
    };
  }

  const data = validation.result;

  const needsReview =
    data.purchasePrice < 100000 ||
    data.purchasePrice > 50000000 ||
    data.buyerNames.some(n => n.toLowerCase().includes("unknown")) ||
    data.propertyAddress.toLowerCase().includes("unknown");

  if (needsReview) {
    console.warn("[extractor] Result flagged for review due to suspicious values");
  }

  return {
    data,
    needsReview,
  };
}