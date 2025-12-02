// src/app/dashboard/billing/page.tsx
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

// ←←← WE DO NOT IMPORT "next/dynamic" AT ALL
// Instead we use React.lazy + Suspense (the only way to avoid the clash)

import { lazy, Suspense } from "react";

const CreditsBadge = lazy(() => import("@/components/ui/CreditsBadge"));

export const dynamic = "force-dynamic"; // ← this stays, no conflict now

export default async function BillingPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { credits: true },
  });

  return (
    <div className="container mx-auto p-6">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Billing & Credits</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-lg">Current credits</p>
            <Suspense
              fallback={
                <span className="inline-block animate-pulse rounded-full bg-muted px-4 py-2 text-sm">
                  Loading…
                </span>
              }
            >
              <CreditsBadge credits={user?.credits ?? 0} />
            </Suspense>
          </div>
          <p className="text-muted-foreground">
            Free tier: 1 parse. Unlimited coming soon.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}