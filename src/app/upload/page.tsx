// src/app/upload/page.tsx
import UploadZone from "@/components/ui/upload/upload-zone";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Sparkles, Shield, Zap, CheckCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function UploadPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const dbUser = await prisma.user.findUnique({
    where: { clerkId: user.id },
    select: { id: true, state: true, credits: true },
  });

  if (!dbUser) redirect("/onboarding");
  if (!dbUser.state || !["CA"].includes(dbUser.state)) {
    redirect("/not-supported");
  }

  const hasCredits = dbUser.credits > 0;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Upload New File</h1>
        <p className="text-muted-foreground text-lg">
          Drop your contract and let AI extract everything in seconds
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Upload Area - 2/3 width */}
        <div className="lg:col-span-2">
          {hasCredits ? (
            <UploadZone />
          ) : (
            <Card className="border-2 border-dashed border-orange-300 bg-gradient-to-br from-orange-50 to-red-50">
              <CardContent className="py-16 text-center">
                <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Sparkles className="h-10 w-10 text-orange-600" />
                </div>
                <h3 className="text-2xl font-bold mb-3">No Credits Remaining</h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  You've used your free extraction. Add more credits to continue parsing contracts.
                </p>
                <Button asChild size="lg">
                  <Link href="/dashboard/billing">Add Credits Now</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar Info - 1/3 width */}
        <div className="space-y-6">
          {/* Credits Card */}
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Available Credits</p>
                <p className="text-4xl font-bold text-primary mb-4">{dbUser.credits}</p>
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link href="/dashboard/billing">Manage Credits</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Features List */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                  <Zap className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">Lightning Fast</p>
                  <p className="text-xs text-muted-foreground">Extracts in ~90 seconds</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                  <CheckCircle className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">95% Accurate</p>
                  <p className="text-xs text-muted-foreground">Handles handwriting</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                  <Shield className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">Auto-Deleted</p>
                  <p className="text-xs text-muted-foreground">Files removed in minutes</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Privacy Notice */}
          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your documents are processed securely and automatically deleted within minutes.
                We never sell or share your data.{" "}
                <Link href="/privacy" className="underline hover:text-foreground">
                  Privacy Policy
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
