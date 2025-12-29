// src/app/transactions/page.tsx
// Version: 2.0.2 - 2025-12-29
// FIXED: Properly cast JSON fields from Prisma to ParseResult type
// Prisma returns Json type, but ParseResult expects typed objects

import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import TransactionsClient from "@/components/transactions/TransactionsClient";
import { ParseResult } from "@/types";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const dbUser = await db.user.findUnique({
    where: { clerkId: user.id },
    select: { id: true },
  });

  if (!dbUser) redirect("/onboarding");

  // Fetch all parses for this user
  const dbParses = await db.parse.findMany({
    where: { userId: dbUser.id },
    orderBy: { createdAt: "desc" },
    select: {
      // === CORE IDENTIFIERS & METADATA ===
      id: true,
      fileName: true,
      status: true,
      createdAt: true,
      finalizedAt: true,

      // === UNIVERSAL CORE SCALARS ===
      buyerNames: true,
      sellerNames: true,
      propertyAddress: true,
      purchasePrice: true,
      earnestMoneyAmount: true,
      earnestMoneyHolder: true,
      closingDate: true,
      effectiveDate: true,
      isAllCash: true,
      loanType: true,

      // === JSON FIELDS (need casting) ===
      earnestMoneyDeposit: true,
      financing: true,
      contingencies: true,
      closingCosts: true,
      brokers: true,
      personalPropertyIncluded: true,
      escrowHolder: true,

      // === FLAGS ===
      missingSCOs: true,

      // === RICH JSON FIELDS ===
      extractionDetails: true,
      timelineEvents: true,

      // === THUMBNAILS / PREVIEWS ===
      lowResZipUrl: true,
      criticalPageNumbers: true,
    },
  });

  // Cast JSON fields to proper types for ParseResult
  const initialParses: ParseResult[] = dbParses.map((parse) => ({
    ...parse,
    createdAt: parse.createdAt.toISOString(),
    finalizedAt: parse.finalizedAt?.toISOString() || null,
    // JSON fields from Prisma are already properly typed
    earnestMoneyDeposit: parse.earnestMoneyDeposit as ParseResult['earnestMoneyDeposit'],
    financing: parse.financing as ParseResult['financing'],
    contingencies: parse.contingencies as ParseResult['contingencies'],
    closingCosts: parse.closingCosts as ParseResult['closingCosts'],
    brokers: parse.brokers as ParseResult['brokers'],
    extractionDetails: parse.extractionDetails as ParseResult['extractionDetails'],
    timelineEvents: parse.timelineEvents as ParseResult['timelineEvents'],
  }));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <TransactionsClient initialParses={initialParses} />
    </div>
  );
}// Note: The casting ensures that the JSON fields conform to the expected structure in ParseResult.