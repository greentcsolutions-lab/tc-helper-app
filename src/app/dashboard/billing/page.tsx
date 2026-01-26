// src/app/dashboard/billing/page.tsx
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { PLAN_CONFIGS } from "@/lib/whop";
import { lazy, Suspense } from "react";
import { CheckCircle2, XCircle, Zap, Loader2 } from "lucide-react";
import { UpgradeButton, BuyCreditsButton, ManageSubscriptionButton } from "@/components/billing/BillingActions";

const CreditsBadge = lazy(() => import("@/components/ui/CreditsBadge"));

export const dynamic = "force-dynamic";

interface BillingPageProps {
  searchParams: Promise<{
    success?: string;
    credits?: string;
    canceled?: string;
  }>;
}

export default async function BillingPage({ searchParams }: BillingPageProps) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const params = await searchParams;

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    select: {
      credits: true,
      planType: true,
      quota: true,
      parseLimit: true,
      parseCount: true,
      parseResetDate: true,
      templateCount: true,
    },
  });

  if (!user) redirect("/sign-in");

  // Count active transactions and custom tasks
  const activeTransactions = await db.parse.count({
    where: {
      user: { clerkId: userId },
      archived: false,
    },
  });

  const customTaskCount = await db.task.count({
    where: {
      user: { clerkId: userId },
      isCustom: true,
      archived: false,
    },
  });

  const planConfig = PLAN_CONFIGS[user.planType as 'FREE' | 'BASIC' | 'STANDARD'] ?? PLAN_CONFIGS.FREE;
  const isFreeUser = user.planType === 'FREE';
  const isBasicUser = user.planType === 'BASIC';

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Success Messages */}
      {params.success && (
        <Alert variant="success">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Welcome to TC Helper! 🎉</AlertTitle>
          <AlertDescription>
            <p className="mb-2">
              Your subscription is being activated. This usually takes just a few seconds.
            </p>
            <p className="text-xs flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              If your plan hasn't updated yet, refresh the page in a moment.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {params.credits && (
        <Alert variant="success">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Credits Purchased! ✅</AlertTitle>
          <AlertDescription>
            <p className="mb-2">
              Your 5 additional AI parse credits are being added to your account.
            </p>
            <p className="text-xs flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Credits should appear in a few seconds. Refresh if needed.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {params.canceled && (
        <Alert>
          <XCircle className="h-4 w-4" />
          <AlertTitle>Checkout Canceled</AlertTitle>
          <AlertDescription>
            Your checkout was canceled. No charges were made. Feel free to try again when you're ready!
          </AlertDescription>
        </Alert>
      )}

      {/* Current Plan Card */}
      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
          <CardDescription>
            {isFreeUser ? 'Upgrade to unlock more features' : 'Thank you for subscribing!'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold">{planConfig.name} Plan</h3>
              <p className="text-sm text-muted-foreground">
                {isFreeUser ? 'Free forever' : `$${planConfig.price.monthly}/month or $${planConfig.price.annual}/year`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {isFreeUser && (
                <>
                  <UpgradeButton size="default" plan="basic" />
                  <UpgradeButton size="default" plan="standard" />
                </>
              )}
              {isBasicUser && (
                <>
                  <UpgradeButton size="default" plan="standard" />
                  <ManageSubscriptionButton />
                </>
              )}
              {!isFreeUser && !isBasicUser && (
                <ManageSubscriptionButton />
              )}
            </div>
          </div>

          {/* Usage Metrics */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-muted-foreground">
                  {isFreeUser ? 'Total Parses' : 'Monthly Parses'}
                </p>
                <Suspense
                  fallback={
                    <span className="inline-block animate-pulse rounded-full bg-muted px-2 py-1 text-xs">
                      ...
                    </span>
                  }
                >
                  <CreditsBadge credits={user.credits} />
                </Suspense>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold">
                  {user.parseCount} / {user.parseLimit}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isFreeUser
                    ? 'Free tier (no reset)'
                    : user.parseResetDate
                      ? `Resets ${new Date(user.parseResetDate).toLocaleDateString()}`
                      : 'No reset scheduled'}
                </p>
              </div>
            </div>

            <div className="rounded-lg border p-4">
              <p className="text-sm font-medium text-muted-foreground mb-2">Active Transactions</p>
              <p className="text-2xl font-bold">
                {activeTransactions} / {user.quota}
              </p>
              <p className="text-xs text-muted-foreground">
                Concurrent files
              </p>
            </div>

            <div className="rounded-lg border p-4">
              <p className="text-sm font-medium text-muted-foreground mb-2">Custom Tasks</p>
              <p className="text-2xl font-bold">
                {customTaskCount} / {planConfig.customTaskLimit}
              </p>
              <p className="text-xs text-muted-foreground">
                Active custom tasks
              </p>
            </div>

            <div className="rounded-lg border p-4">
              <p className="text-sm font-medium text-muted-foreground mb-2">Task Templates</p>
              <p className="text-2xl font-bold">
                {user.templateCount} / {planConfig.templateLimit}
              </p>
              <p className="text-xs text-muted-foreground">
                Saved templates
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Buy Credits Card */}
      <Card>
        <CardHeader>
          <CardTitle>Need More Parses?</CardTitle>
          <CardDescription>
            Purchase additional AI parse credits anytime
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Credit Pack</p>
              <p className="text-sm text-muted-foreground">5 AI parses for $10</p>
            </div>
            <BuyCreditsButton variant="outline" />
          </div>
        </CardContent>
      </Card>

      {/* Plan Comparison Card */}
      {(isFreeUser || isBasicUser) && (
        <Card>
          <CardHeader>
            <CardTitle>Plan Comparison</CardTitle>
            <CardDescription>
              {isFreeUser ? 'See what you get with our paid plans' : 'Upgrade to Standard for more power'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className={isFreeUser ? '' : 'opacity-50'}>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-muted-foreground" />
                  Free Plan
                </h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    1 AI parse (total)
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    1 transaction
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    10 custom tasks
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    1 template
                  </li>
                </ul>
              </div>

              <div className={isBasicUser ? '' : isFreeUser ? '' : 'opacity-50'}>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  Basic Plan
                  <span className="text-xs text-muted-foreground font-normal">$20/mo</span>
                </h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    5 AI parses/month
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    20 transactions
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    100 custom tasks
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    10 templates
                  </li>
                </ul>
                {isFreeUser && (
                  <div className="mt-4">
                    <UpgradeButton size="sm" plan="basic" />
                  </div>
                )}
              </div>

              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Zap className="h-5 w-5 text-blue-500" />
                  Standard Plan
                  <span className="text-xs text-muted-foreground font-normal">$50/mo</span>
                </h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    50 AI parses/month
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    500 transactions
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    Unlimited tasks
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    50 templates
                  </li>
                  <li className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-blue-400" />
                    Calendar sync (soon)
                  </li>
                  <li className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-blue-400" />
                    Communications (soon)
                  </li>
                </ul>
                {(isFreeUser || isBasicUser) && (
                  <div className="mt-4">
                    <UpgradeButton size="sm" plan="standard" />
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}