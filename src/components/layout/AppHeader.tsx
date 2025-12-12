// src/components/layout/AppHeader.tsx
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
import { Plus, ChevronDown, FileUp, LayoutDashboard } from "lucide-react";

export default function AppHeader() {
  return (
    <header className="border-b border-white/20 bg-white/70 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60">
      <div className="container mx-auto px-6 py-5 flex justify-between items-center">
        {/* Logo — Mirror’s Edge signature */}
        <Link href="/" className="flex items-center gap-4 group">
          <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-lg group-hover:shadow-cyan-500/25 transition-all duration-300">
            TC
          </div>
          <span className="text-2xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent hidden md:inline">
            TC Pro
          </span>
        </Link>

        {/* Right side — clean, minimal, premium */}
        <div className="flex items-center gap-5">
          <SignedIn>
            {/* Dashboard link — always visible on larger screens */}
            <Button variant="ghost" asChild className="hidden md:flex text-foreground/80 hover:text-foreground hover:bg-white/50">
              <Link href="/dashboard" className="flex items-center gap-2.5">
                <LayoutDashboard className="h-4.5 w-4.5" />
                Dashboard
              </Link>
            </Button>

            {/* New dropdown — your signature cyan button */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-medium shadow-lg hover:shadow-cyan-500/30 transition-all duration-300">
                  <Plus className="h-4.5 w-4.5" />
                  New
                  <ChevronDown className="h-4 w-4 ml-1 opacity-80" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 border-white/20 bg-white/90 backdrop-blur-xl">
                <DropdownMenuLabel className="text-foreground/70">Quick Actions</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/20" />
                <DropdownMenuItem asChild>
                  <Link href="/upload" className="flex items-center gap-3 py-3 cursor-pointer hover:bg-cyan-50/50 rounded-lg mx-2">
                    <FileUp className="h-5 w-5 text-cyan-600" />
                    <div>
                      <div className="font-medium">Upload New Contract</div>
                      <div className="text-xs text-muted-foreground/60">Start a new extraction</div>
                    </div>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard" className="flex items-center gap-3 py-3 cursor-pointer hover:bg-cyan-50/50 rounded-lg mx-8 mx-2">
                    <LayoutDashboard className="h-5 w-5 text-blue-600" />
                    <div>
                      <div className="font-medium">Go to Dashboard</div>
                      <div className="text-xs text-muted-foreground/60">View all your files</div>
                    </div>
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: "h-10 w-10 ring-2 ring-cyan-500/20",
                },
              }}
            />
          </SignedIn>

          <SignedOut>
            <SignInButton mode="redirect">
              <Button variant="ghost" className="text-foreground/80 hover:text-foreground">
                Sign In
              </Button>
            </SignInButton>
            <SignUpButton mode="redirect">
              <Button className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-medium shadow-lg hover:shadow-cyan-500/30 transition-all">
                Get Started Free
              </Button>
            </SignUpButton>
          </SignedOut>
        </div>
      </div>
    </header>
  );
}