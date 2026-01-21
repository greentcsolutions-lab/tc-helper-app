"use client";

import { UserButton, SignedIn, SignedOut, SignInButton, SignUpButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import ThemeToggle from "./ThemeToggle";
import CreditsBadge from "@/components/ui/CreditsBadge";
import { Sparkles } from "lucide-react";
import Link from "next/link";

interface ModernHeaderProps {
  credits?: number;
  sidebarCollapsed?: boolean;
}

export default function ModernHeader({ credits, sidebarCollapsed }: ModernHeaderProps) {
  return (
    <header className="h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30">
      <div className="h-full flex items-center justify-between px-6 gap-4">
        
        {/* Left side - Occupies space to help center the middle */}
        <div className="flex-1">
            {/* You could place a Logo here if needed */}
        </div>

        {/* Center - Public Navigation Links */}
        <SignedOut>
          <nav className="hidden md:flex items-center divide-x divide-muted-foreground/40">
            <Link href="/" className="px-4 text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              Home
            </Link>
            <Link href="/plans" className="px-4 text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              Plans
            </Link>
            <Link href="/about" className="px-4 text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              About
            </Link>
          </nav>
        </SignedOut>

        {/* Right side - Global actions */}
        <div className="flex-1 flex items-center justify-end gap-3">
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
            <div className="flex items-center gap-3">
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
            </div>
          </SignedOut>
        </div>
      </div>
    </header>
  );
}