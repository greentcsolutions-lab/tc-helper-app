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
      {/* Hero */}
      <div className="mb-12 text-center lg:text-left">
        <h1 className="text-5xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
          Welcome back
        </h1>
        <p className="mt-4 text-xl text-muted-foreground">
          Upload a California RPA packet • Grok extracts everything in seconds
        </p>
      </div>

      {/* MAIN GRID — generous spacing + proper card separation */}
      <div className="grid lg:grid-cols-3 gap-12 xl:gap-16">
        {/* LEFT: Upload Zone (2/3 width) */}
        <div className="lg:col-span-2">
          {hasCredits ? (
            <div className="p-8 lg:p-12"> {/* THIS IS THE ONLY CHANGE — gives UploadZone breathing room */}
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

        {/* RIGHT: Sidebar */}
        <div className="space-y-12"> {/* increased from space-y-6 → space-y-12 */}
          {/* Quick Actions */}
          <Card className="overflow-hidden border-0 shadow-xl bg-gradient-to-br from-primary/5 via-background to-secondary/30 backdrop-blur-xl">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent rounded-2xl" />
            <CardHeader className="relative">
              <CardTitle className="text-2xl flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-xl">
                  <Sparkles className="w-6 h-6 text-primary" />
                </div>
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="relative space-y-4">
              <Button asChild variant="secondary" size="lg" className="w-full justify-start text-lg h-14 hover:shadow-lg hover:scale-105 transition-all">
                <Link href="/parses">
                  <History className="mr-3 h-5 w-5" />
                  View Past Parses
                </Link>
              </Button>

              <Button asChild size="lg" className="w-full justify-start text-lg h-14 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all">
                <Link href="/dashboard/billing">
                  <CreditCard className="mr-3 h-5 w-5" />
                  Billing & Credits
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Credits Badge */}
          {dbUser?.credits !== undefined && (
            <Card className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/20">
              <CardContent className="pt-8 pb-10 text-center">
                <p className="text-sm text-muted-foreground">Credits Remaining</p>
                <p className="text-5xl font-bold text-green-600 dark:text-green-400 mt-3">
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