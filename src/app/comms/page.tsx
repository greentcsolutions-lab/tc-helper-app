// src/app/comms/page.tsx
// Communications Center main page

import { Suspense } from 'react';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import CommsCenter from '@/components/comms/CommsCenter';
import { Loader2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Comms Center | TC Helper',
  description: 'Manage your email communications',
};

function LoadingState() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

export default async function CommsPage() {
  const user = await currentUser();

  if (!user) {
    redirect('/sign-in?redirect_url=/comms');
  }

  const dbUser = await db.user.findUnique({
    where: { clerkId: user.id },
    select: { id: true, planType: true, email: true },
  });

  if (!dbUser) {
    redirect('/dashboard');
  }

  // Check if user has DEV plan
  if (dbUser.planType !== 'DEV') {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-3xl font-bold mb-4">Comms Center</h1>
          <div className="bg-muted/50 rounded-lg p-8 border">
            <p className="text-muted-foreground mb-4">
              The Communications Center is currently in development and only available to DEV plan users.
            </p>
            <p className="text-sm text-muted-foreground">
              This feature will be available to Standard plan users and above once testing is complete.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<LoadingState />}>
      <CommsCenter userId={dbUser.id} userEmail={dbUser.email || ''} />
    </Suspense>
  );
}
