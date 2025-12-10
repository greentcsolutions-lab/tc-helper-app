// src/components/layout/AppHeader.tsx   ← replace your current file with this

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { UserButton, SignedIn, SignedOut, SignInButton, SignUpButton } from "@clerk/nextjs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, ChevronDown, FileUp, LayoutDashboard, Home } from "lucide-react";

export default function AppHeader() {
  return (
    <header className="border-b bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-xl">
            TC
          </div>
          <span className="text-xl font-semibold hidden sm:inline">TC Pro</span>
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-4">
          <SignedIn>
            {/* Always-visible Dashboard link */}
            <Button variant="ghost" asChild className="hidden sm:flex">
              <Link href="/dashboard">
                <LayoutDashboard className="h-4 w-4 mr-2" />
                Dashboard
              </Link>
            </Button>

            {/* New dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="default" className="gap-2">
                  <Plus className="h-4 w-4" />
                  New
                  <ChevronDown className="h-4 w-4 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Quick Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/upload" className="flex items-center gap-3">
                    <FileUp className="h-4 w-4" />
                    Upload New Packet
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard" className="flex items-center gap-3">
                    <LayoutDashboard className="h-4 w-4" />
                    Go to Dashboard
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <UserButton afterSignOutUrl="/" />
          </SignedIn>

          <SignedOut>
            <SignInButton mode="redirect">
              <Button variant="ghost">Sign In</Button>
            </SignInButton>
            <SignUpButton mode="redirect">
              <Button>Get Started Free</Button>
            </SignUpButton>
          </SignedOut>
        </div>
      </div>
    </header>
  );
}