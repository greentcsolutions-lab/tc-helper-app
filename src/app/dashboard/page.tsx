// src/app/dashboard/page.tsx
import UploadZone from "@/components/ui/upload/upload-zone";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";
import { CreditCard, History, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const user = await currentUser();
  if (!user) return null;

  const dbUser = await prisma.user.findUnique({
    where: { clerkId: user.id },
    select: { credits: true },
  });

  const hasCredits = dbUser?.credits && dbUser.credits > 0;

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Hero Greeting */}
      <div className="mb-12 text-center lg:text-left">
        <h1 className="text-5xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
          Welcome back
        </h1>
        <p className="mt-4 text-xl text-muted-foreground">
          Upload a California RPA packet • Grok extracts everything in seconds
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-10 xl:gap-12">
        {/* LEFT: Upload Zone (2/3 width) */}
        <div className="lg:col-span-2">
          {hasCredits ? (
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 to-purple-600/10 rounded-3xl blur-3xl -z-10" />
              <UploadZone />
            </div>
          ) : (
            <Card className="border-2 border-dashed border-red-400/30 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/40 dark:to-orange-950/30 backdrop-blur-xl">
              <CardContent className="pt-16 pb-20 text-center">
                <div className="mx-auto w-24 h-24 bg-red-100 dark:bg-red-900/50 rounded-full flex items-center justify-center mb-8">
                  <Sparkles className="w-12 h-12 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-3xl font-bold mb-4">No parses remaining</h3>
                <p className="text-lg text-muted-foreground mb-8 max-w-sm mx-auto">
                  You’ve used your free extraction. Upgrade for unlimited AI parsing.
                </p>
                <Button asChild size="lg" className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white shadow-lg">
                  <Link href="/dashboard/billing">
                    <CreditCard className="mr-2 h-5 w-5" />
                    Add Credits Now
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* RIGHT: PREMIUM QUICK ACTIONS SIDEBAR */}
        <div className="space-y-6">
          <Card className="overflow-hidden border-0 shadow-2xl bg-gradient-to-br from-primary/10 via-background to-purple-600/5 backdrop-blur-xl">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-purple-600/10 rounded-3xl" />
            
            <CardHeader className="relative pb-8">
              <CardTitle className="text-3xl font-bold flex items-center gap-4">
                <div className="p-3 bg-primary/20 rounded-2xl backdrop-blur-sm">
                  <Sparkles className="w-8 h-8 text-primary" />
                </div>
                Quick Actions
              </CardTitle>
              <p className="text-muted-foreground mt-2 text-lg">Everything you need, instantly</p>
            </CardHeader>

            <CardContent className="relative space-y-5">
              <Button
                asChild
                variant="secondary"
                size="lg"
                className="w-full justify-start text-lg h-16 hover:shadow-xl transition-all hover:scale-105 hover:bg-accent/80"
              >
                <Link href="/parses">
                  <History className="mr-4 h-6 w-6" />
                  View Past Parses
                </Link>
              </Button>

              <Button
                asChild
                size="lg"
                className="w-full justify-start text-lg h-16 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary text-white shadow-xl hover:shadow-2xl transition-all hover:scale-105"
              >
                <Link href="/dashboard/billing">
                  <CreditCard className="mr-4 h-6 w-6" />
                  Billing & Credits
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Credit Balance Badge */}
          {dbUser?.credits !== undefined && (
            <Card className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/20">
              <CardContent className="pt-6 text-center">
                <p className="text-sm text-muted-foreground">Credits Remaining</p>
                <p className="text-4xl font-bold text-green-600 dark:text-green-400 mt-2">
                  {dbUser.credits}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}