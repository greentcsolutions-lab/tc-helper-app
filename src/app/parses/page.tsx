// src/app/parses/page.tsx — SERVER COMPONENT ONLY
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import PastResultsClient from "./PastResultsClient";

export const dynamic = "force-dynamic";

export default async function PastResultsPage() {
  const { userId } = await auth();
  if (!userId) {
    return (
      <div className="container mx-auto p-8 text-center">
        <h1 className="text-3xl font-bold mb-4">Sign in required</h1>
      </div>
    );
  }

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    select: { id: true },
  });

  if (!user) return <div>User not found</div>;

  const parses = await db.parse.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return <PastResultsClient initialParses={parses} />;
}