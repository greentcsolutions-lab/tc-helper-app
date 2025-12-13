// src/app/dashboard/page.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { FileUp, History, Sparkles, TrendingUp, Clock, CheckCircle } from "lucide-react";
import NextDueCard from "@/components/dashboard/NextDueCard";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const dbUser = await prisma.user.findUnique({
    where: { clerkId: user.id },
    select: { credits: true, id: true },
  });

  if (!dbUser) redirect("/onboarding");

  const parseCount = await prisma.parse.count({
    where: { userId: dbUser.id },
  });

  const recentParses = await prisma.parse.findMany({
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
  const completedParses = await prisma.parse.findMany({
    where: {
      userId: dbUser.id,
      status: { in: ["COMPLETED", "NEEDS_REVIEW"] },
    },
    select: {
      id: true,
      formatted: true,
    },
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Welcome Header */}
      <div>
        <h1 className="text-4xl font-bold mb-2">Welcome back!</h1>
        <p className="text-muted-foreground text-lg">
          Here's what's happening with your transactions
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Credits</CardTitle>
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{dbUser.credits}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {dbUser.credits === 0 ? "Get more to continue" : "Ready to use"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Parses</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{parseCount}</div>
            <p className="text-xs text-muted-foreground mt-1">All time extractions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {recentParses.filter(p => {
                const monthAgo = new Date();
                monthAgo.setMonth(monthAgo.getMonth() - 1);
                return new Date(p.createdAt) > monthAgo;
              }).length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Recent activity</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">99.9%</div>
            <p className="text-xs text-muted-foreground mt-1">Extraction accuracy</p>
          </CardContent>
        </Card>
      </div>

      {/* Next Due Card - NEW */}
      <NextDueCard parses={completedParses} />

      {/* Quick Actions */}
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
              <History className="h-5 w-5" />
              View Past Parses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Review and manage your extracted contract data
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/transactions">
                <History className="mr-2 h-4 w-4" />
                View All Parses
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
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

      {dbUser.credits === 0 && (
        <Card className="border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-transparent">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                <Sparkles className="h-6 w-6 text-orange-600" />
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
