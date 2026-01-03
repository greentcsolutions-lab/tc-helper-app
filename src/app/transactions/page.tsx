// src/app/transactions/page.tsx
// Version: 2.0.4 - 2025-12-30
// FIXED: Proper null handling for finalizedAt and renderZipUrl
// Dummy comment

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
    select: {
      id: true,
      quota: true,
    },
  });

  if (!dbUser) redirect("/onboarding");

  // Fetch all parses for this user (including archived for the client to filter)
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
      transactionType: true,
      buyerNames: true,
      sellerNames: true,
      propertyAddress: true,
      purchasePrice: true,
      earnestMoneyAmount: true,
      earnestMoneyHolder: true,
      closingDate: true,
      effectiveDate: true,
      initialDepositDueDate: true,
      sellerDeliveryOfDisclosuresDate: true,
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
      renderZipUrl: true,
      criticalPageNumbers: true,
    },
  });

  // Cast JSON fields to proper types for ParseResult
  const initialParses: ParseResult[] = dbParses.map((parse) => ({
    ...parse,
    createdAt: parse.createdAt.toISOString(),
    finalizedAt: parse.finalizedAt ? parse.finalizedAt.toISOString() : null,
    // JSON fields from Prisma are already properly typed
    earnestMoneyDeposit: parse.earnestMoneyDeposit as ParseResult['earnestMoneyDeposit'],
    financing: parse.financing as ParseResult['financing'],
    contingencies: parse.contingencies as ParseResult['contingencies'],
    closingCosts: parse.closingCosts as ParseResult['closingCosts'],
    brokers: parse.brokers as ParseResult['brokers'],
    extractionDetails: parse.extractionDetails as ParseResult['extractionDetails'],
    timelineEvents: parse.timelineEvents as ParseResult['timelineEvents'],
    lowResZipUrl: parse.renderZipUrl ?? null,
  }));

  // Count only non-archived parses for the active count
  const activeCount = dbParses.filter(p => p.status !== "ARCHIVED").length;

  return (
    <div className="p-0.5">
      <TransactionsClient
        initialParses={initialParses}
        userQuota={dbUser.quota}
        activeCount={activeCount}
      />
    </div>
  );
}