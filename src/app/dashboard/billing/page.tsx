// src/app/dashboard/billing/page.tsx
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import dynamic from "next/dynamic";

// ←←← CRITICAL: rename the import so it doesn’t clash with the export const dynamic below
const DynamicCreditsBadge = dynamic(() => import("@/components/ui/CreditsBadge"), {
  ssr: false,
  loading: () => (
    <div className="inline-flex items-center rounded-full bg-muted px-4 py-2 text-sm">
      Loading…
    </div>
  ),
});

// This line is REQUIRED for server components that do DB/auth calls in App Router
export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { credits: true },
  });

  const credits = user?.credits ?? 0;

  return (
    <div className="container mx-auto p-6">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Billing & Credits</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-lg">Current credits</p>
            <DynamicCreditsBadge credits={credits} />
          </div>
          <p className="text-muted-foreground">
            Free tier gives you 1 parse. Paid plans coming soon.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}