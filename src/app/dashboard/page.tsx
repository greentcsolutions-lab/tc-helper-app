// src/app/dashboard/page.tsx
import UploadZone from "@/components/ui/upload/upload-zone";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const user = await currentUser();
  if (!user) return null; // Should never happen due to layout redirect

  const dbUser = await prisma.user.findUnique({
    where: { clerkId: user.id },
    select: { credits: true },
  });

  const hasCredits = dbUser?.credits && dbUser.credits > 0;

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="mb-10">
        <h1 className="text-4xl font-bold mb-2">Welcome back</h1>
        <p className="text-muted-foreground text-lg">
          Upload a California real estate packet to extract RPA data instantly.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          {hasCredits ? (
            <UploadZone />
          ) : (
            <Card className="border-dashed border-2 border-red-300 bg-red-50">
              <CardContent className="pt-10 text-center">
                <div className="text-6xl mb-4">No parses remaining</div>
                <p className="text-muted-foreground mb-6">
                  You’ve used all your free parses.
                </p>
                <Button asChild size="lg">
                  <Link href="/dashboard/billing">Add Credits →</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button asChild variant="outline" className="w-full justify-start">
                <Link href="/parses">View Past Parses</Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-start">
                <Link href="/dashboard/billing">Billing & Credits</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="text-lg">Pro Tip</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Works only with digital PDFs at this time. We are working to add OCR capabilities for scanned documents.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}