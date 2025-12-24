// src/app/transactions/page.tsx
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { redirect } from "next/navigation";
import TransactionsClient from "@/components/transactions/TransactionsClient";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    select: { id: true },
  });

  if (!user) redirect("/onboarding");

  // Fetch ONLY completed parses (COMPLETED or NEEDS_REVIEW status)
  const parses = await db.parse.findMany({
    where: {
      userId: user.id,
      status: { in: ["COMPLETED", "NEEDS_REVIEW"] },
    },
    orderBy: { createdAt: "desc" },
    select: {
      // === CORE METADATA ===
      id: true,
      fileName: true,
      status: true,
      createdAt: true,
      finalizedAt: true,
      missingSCOs: true,

      // === UNIVERSAL CORE FIELDS ===
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

      // === RICH DATA ===
      extractionDetails: true,
      timelineEvents: true,

      // === THUMBNAILS (optional but useful) ===
      lowResZipUrl: true,
      criticalPageNumbers: true,
    },
  });

  return <TransactionsClient initialParses={parses} />;
}