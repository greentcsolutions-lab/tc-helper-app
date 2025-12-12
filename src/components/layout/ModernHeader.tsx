// src/components/layout/ModernHeader.tsx
"use client";

import { UserButton, SignedIn, SignedOut, SignInButton, SignUpButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import ThemeToggle from "./ThemeToggle";
import CreditsBadge from "@/components/ui/CreditsBadge";
import { Sparkles } from "lucide-react";

interface ModernHeaderProps {
  credits?: number;
  sidebarCollapsed?: boolean;
}

export default function ModernHeader({ credits, sidebarCollapsed }: ModernHeaderProps) {
  return (
    <header className="h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30">
      <div className="h-full flex items-center justify-between px-6 gap-4">
        {/* Left side - Empty space for content if needed */}
        <div className="flex-1" />

        {/* Right side - Global actions */}
        <div className="flex items-center gap-3">
          <SignedIn>
            {/* Credits Badge */}
            {credits !== undefined && (
              <div className="hidden sm:block">
                <CreditsBadge credits={credits} />
              </div>
            )}

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* User Button */}
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: "h-9 w-9 rounded-full ring-2 ring-primary/10 hover:ring-primary/30 transition-all",
                  userButtonPopoverCard: "shadow-xl",
                },
              }}
            />
          </SignedIn>

          <SignedOut>
            <SignInButton mode="modal">
              <Button variant="ghost" size="sm">
                Sign In
              </Button>
            </SignInButton>
            <SignUpButton mode="modal">
              <Button size="sm" className="gap-2">
                <Sparkles className="h-4 w-4" />
                Get Started
              </Button>
            </SignUpButton>
          </SignedOut>
        </div>
      </div>
    </header>
  );
}
