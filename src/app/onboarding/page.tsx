'use client';

import { UserButton, useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const usStates = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
] as const;

type State = typeof usStates[number];

export default function OnboardingPage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const router = useRouter();
  const [state, setState] = useState<State | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isLoaded && isSignedIn && (user?.publicMetadata?.onboarded as boolean)) {
      router.replace('/dashboard');
    }
  }, [isLoaded, isSignedIn, user, router]);

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-lg text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!state) return;
    setSaving(true);

    try {
      const res = await fetch('/api/save-user-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state, onboarded: true }),
      });

      if (res.ok) {
        await user?.reload();
        router.push('/dashboard');
      } else {
        alert('Failed to save. Please try again.');
      }
    } catch (err) {
      console.error('Onboarding error:', err);
      alert('Network error. Please check your connection.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-2xl shadow-xl border border-border p-8 sm:p-10">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Welcome to TC Helper!</h1>
              <p className="text-muted-foreground mt-2">Let’s get you set up in 10 seconds</p>
            </div>
            <UserButton />
          </div>

          <div className="space-y-8">
            <div>
              <p className="text-lg text-foreground mb-6">
                You get <span className="font-bold text-green-600 dark:text-green-400">1 completely free RPA parse</span> right now.
              </p>

              <div className="space-y-3">
                <label htmlFor="state" className="block text-sm font-medium text-foreground">
                  What state do you work in?
                </label>
                <select
                  id="state"
                  value={state ?? ""}
                  onChange={(e) => setState((e.target.value as State) || null)}
                  className="w-full px-4 py-3 rounded-lg border border-input bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary transition"
                >
                  <option value="">Select your state</option>
                  {usStates.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={saving || !state}
              className="w-full bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground text-primary-foreground font-semibold py-4 rounded-lg transition duration-200 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : "Start My Free Parse"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}