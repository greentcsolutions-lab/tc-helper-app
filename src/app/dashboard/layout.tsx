// src/app/(dashboard)/layout.tsx
import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import CreditsBadge from "@/components/ui/CreditsBadge";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const dbUser = await prisma.user.findUnique({
    where: { clerkId: user.id },
    select: { id: true, state: true, credits: true },
  });

  if (!dbUser) {
    redirect("/onboarding");
  }

  if (!dbUser.state || !["CA"].includes(dbUser.state)) {
    redirect("/not-supported");
  }

  return (
    <>
      {/* Top bar – now uses bg-background instead of bg-white */}
      <div className="border-b bg-background">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold">RPA Parser</h2>
          <CreditsBadge credits={dbUser.credits} />
        </div>
      </div>

      {/* Main content – uses muted/50 which looks great in both light & dark */}
      <div className="min-h-screen bg-muted/50">
        {children}
      </div>
    </>
  );
}