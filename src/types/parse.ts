// src/types/parse.ts
import { JsonValue } from "@prisma/client/runtime/library";

export interface ParseResult {
  // === CORE IDENTIFIERS & METADATA ===
  id: string;
  fileName: string;
  status: string;
  createdAt: string | Date;
  finalizedAt: string | Date | null;

  // === UNIVERSAL CORE FIELDS ===
  buyerNames: string[] | null;
  sellerNames: string[] | null;
  propertyAddress: string | null;
  purchasePrice: number | null;
  earnestMoneyAmount: number | null;
  earnestMoneyHolder: string | null;
  closingDate: string | null;
  effectiveDate: string | null;
  isAllCash: boolean | null;
  loanType: string | null;

  // === FLAGS ===
  missingSCOs: boolean;

  // === RICH JSON FIELDS ===
  // Prisma Json fields come back as JsonValue — we widen to any but keep shape hints
  extractionDetails?: {
    route?: "universal" | "california" | "california-fallback-universal";
    [key: string]: any;
  } | JsonValue | null;

  timelineEvents?: JsonValue | null;

  // === THUMBNAILS / PREVIEWS ===
  lowResZipUrl?: string | null;
  criticalPageNumbers?: number[] | null;
}