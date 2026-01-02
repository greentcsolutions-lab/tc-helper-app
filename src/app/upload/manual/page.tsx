// src/app/upload/manual/page.tsx
// Manual transaction creation wizard page

import { redirect } from 'next/navigation';
import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import ManualTransactionWizard from '@/components/wizard/ManualTransactionWizard';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ManualUploadPage() {
  const user = await currentUser();
  if (!user) redirect('/sign-in');

  const dbUser = await prisma.user.findUnique({
    where: { clerkId: user.id },
    select: { id: true, state: true },
  });

  if (!dbUser) redirect('/onboarding');

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-white">
        <div className="max-w-7xl mx-auto p-6">
          <Link
            href="/upload"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Upload
          </Link>
          <h1 className="text-3xl font-bold">Create Transaction Manually</h1>
          <p className="text-muted-foreground mt-2">
            Fill out the form below to create a new transaction without uploading
            documents
          </p>
        </div>
      </div>

      {/* Wizard */}
      <ManualTransactionWizard userState={dbUser.state || 'CA'} />
    </div>
  );
}
