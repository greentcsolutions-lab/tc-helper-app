// src/app/dashboard/page.tsx
// Version: 2.0.0 - Reorganized for workflow priority
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { db } from "@/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { FileUp, FileText, Sparkles, TrendingUp, Clock, CheckCircle, Zap } from "lucide-react";
import NextDueCard from "@/components/dashboard/NextDueCard";
import NextClosingCard from "@/components/dashboard/NextClosingCard";
import NextTaskCard from "@/components/dashboard/NextTaskCard";
import { UpgradeButton } from "@/components/billing/BillingActions";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const dbUser = await db.user.findUnique({
    where: { clerkId: user.id },
    select: {
      credits: true,
      id: true,
      planType: true,
    },
  });

  if (!dbUser) redirect("/onboarding");

  const isFreeUser = dbUser.planType === 'FREE';

  const parseCount = await db.parse.count({
    where: { userId: dbUser.id },
  });

  const recentParses = await db.parse.findMany({
    where: { userId: dbUser.id },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      fileName: true,
      createdAt: true,
      status: true,
    },
  });

  // Fetch completed parses for timeline
  const completedParses = await db.parse.findMany({
    where: {
      userId: dbUser.id,
      status: { in: ["COMPLETED", "NEEDS_REVIEW"] },
    },
    select: {
      id: true,
      propertyAddress: true,
      closingDate: true,
      effectiveDate: true,
      initialDepositDueDate: true,
      sellerDeliveryOfDisclosuresDate: true,
      earnestMoneyDeposit: true,
      contingencies: true,
    },
  });

  // Fetch tasks for NextTaskCard (exclude archived tasks)
  const tasks = await db.task.findMany({
    where: {
      userId: dbUser.id,
      archived: {
        not: true, // Exclude archived tasks
      },
    },
    include: {
      parse: {
        select: {
          id: true,
          propertyAddress: true,
        },
      },
    },
    orderBy: {
      dueDate: 'asc',
    },
  });

  const thisMonthCount = recentParses.filter(p => {
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    return new Date(p.createdAt) > monthAgo;
  }).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Welcome Header */}
      <div>
        <h1 className="text-4xl font-bold mb-2">Welcome back!</h1>
        <p className="text-muted-foreground text-lg">
          Here's your daily workflow
        </p>
      </div>

      {/* Upgrade CTA for Free Users */}
      {isFreeUser && (
        <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/10 via-purple-500/5 to-cyan-500/5">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1">Unlock the Power of Basic Plan</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    Get 5 AI parses per month, 20 concurrent transactions, and 100 custom tasks for just $15/month
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• 5x more AI parses</li>
                    <li>• 20x more concurrent transactions</li>
                    <li>• 10x more custom tasks</li>
                  </ul>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href="/dashboard/billing">Learn More</Link>
                </Button>
                <UpgradeButton size="default" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* PRIORITY 1: Next Due, Next Closing & Next Task - Most Important */}
      <div className="grid gap-6 md:grid-cols-3">
        <NextDueCard parses={completedParses} />
        <NextClosingCard parses={completedParses} />
        <NextTaskCard tasks={tasks} />
      </div>

      {/* PRIORITY 2: Quick Actions - Primary Workflow */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileUp className="h-5 w-5 text-primary" />
              Upload New Contract
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {dbUser.credits > 0
                ? "Start a new extraction with AI-powered parsing"
                : "You need credits to upload a new contract"}
            </p>
            <Button asChild disabled={dbUser.credits === 0} className="w-full">
              <Link href="/upload">
                <FileUp className="mr-2 h-4 w-4" />
                Upload Contract
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              View Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Review and manage all your extracted contract data
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/transactions">
                <FileText className="mr-2 h-4 w-4" />
                View All Transactions
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* PRIORITY 3: Recent Activity - Secondary Info */}
      {recentParses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Extractions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentParses.map((parse) => (
                <div
                  key={parse.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FileUp className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{parse.fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(parse.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/parse/${parse.id}`}>View</Link>
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* PRIORITY 4: Stats - Reference Info */}
      <Card>
        <CardHeader>
          <CardTitle>System Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{dbUser.credits}</p>
                <p className="text-sm text-muted-foreground">Available Credits</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{parseCount}</p>
                <p className="text-sm text-muted-foreground">Total Parses</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Clock className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{thisMonthCount}</p>
                <p className="text-sm text-muted-foreground">This Month</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">99.9%</p>
                <p className="text-sm text-muted-foreground">Accuracy</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alert: No Credits */}
      {dbUser.credits === 0 && (
        <Card className="border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-transparent dark:border-orange-900 dark:from-orange-950/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
                <Sparkles className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1">Out of Credits</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Add more credits to continue extracting contract data with AI
                </p>
                <Button asChild>
                  <Link href="/dashboard/billing">Add Credits</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
