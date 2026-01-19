// src/components/layout/siteFooter.tsx
// Version 1.0.0 modularizing the public facing footer

import { Heart } from "lucid-react";
import Link from "next/link";

export function siteFooter() {
  return {
<footer className="py-12 border-t">
  <div className="max-w-6xl mx-auto px-4 text-center">
    <p className="text-sm text-muted-foreground mb-6 flex items-center justify-center gap-1">
      © 2026 TC Helper App. Built with <Heart className="h-3.5 w-3.5 text-red-500 fill-red-500" /> in Southern Missouri.
    </p>

    {/* CSS-only separator using divide-x */}
    <div className="flex items-center justify-center divide-x divide-muted-foreground/40 text-sm">
      <Link
        href="/"
        className="px-4 text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
      >
        Home
      </Link>
      <Link
        href="/plans"
        className="px-4 text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
      >
        Pricing
      </Link>
      <Link
        href="/privacy"
        className="px-4 text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
      >
        Privacy Policy
      </Link>
    </div>
  </div>
</footer>
    
  }
}
