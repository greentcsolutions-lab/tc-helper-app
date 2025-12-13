// src/app/transactions/page.tsx
// Version: 1.0.0
// Server component that fetches completed parses and renders TransactionsClient

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { redirect } from "next/navigation";
import TransactionsClient from "./TransactionsClient";

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
      id: true,
      fileName: true,
      formatted: true,
      createdAt: true,
      finalizedAt: true,
      status: true,
      missingSCOs: true,
    },
  });

  return <TransactionsClient initialParses={parses} />;
}
