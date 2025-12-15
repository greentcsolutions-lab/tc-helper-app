// src/app/timeline/page.tsx
// Version: 1.0.0 - Timeline calendar page server component
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { redirect } from "next/navigation";
import TimelineClient from "./TimelineClient";

export const dynamic = "force-dynamic";

export default async function TimelinePage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    select: { id: true },
  });

  if (!user) redirect("/onboarding");

  // Fetch all completed parses with formatted data
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
    },
  });

  return <TimelineClient parses={parses} />;
}
