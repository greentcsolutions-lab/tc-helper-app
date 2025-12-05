// src/app/page.tsx
// 12/03/2025
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";
import { currentUser } from "@clerk/nextjs/server";
import { UserButton, SignInButton, SignUpButton, SignedOut } from "@clerk/nextjs";

export default async function Home() {
  
  const user = await currentUser();

  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b">
        <div className="container mx-auto px-4 py-6 flex justify-between items-center">
          <h1 className="text-2xl font-bold">TC Helper</h1>

          <div className="space-x-4 flex items-center">
            {user ? (
              <>
                <Button variant="ghost" asChild>
                  <Link href="/dashboard">Dashboard</Link>
                </Button>
                <UserButton />
              </>
            ) : (
              <SignedOut>
                <SignInButton mode="redirect">
                  <Button variant="ghost">Sign In</Button>
                </SignInButton>

                <SignUpButton mode="redirect">
                  <Button>Get Started Free</Button>
                </SignUpButton>
              </SignedOut>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="container mx-auto px-4 py-24 text-center">
          <h2 className="text-5xl font-bold mb-6">
            The Fastest Real Estate Contract Extractor on Earth
          </h2>
          <p className="text-xl text-muted-foreground mb-12 max-w-3xl mx-auto">
            Powered by Grok 4. Turn any scanned or digital real estate packet into perfectly formatted data in seconds.
          </p>
          <div className="flex gap-4 justify-center">
            <SignedOut>
              <SignUpButton mode="redirect">
                <Button size="lg">Start Free → 1 Credit Included</Button>
              </SignUpButton>
            </SignedOut>
          </div>
        </section>

        <section className="py-24 bg-muted/50">
          <div className="container mx-auto px-4">
            <h3 className="text-3xl font-bold text-center mb-12">Why TCs Love TC Helper</h3>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                "99%+ accuracy on all RPA fields",
                "Detects missing Seller Counter Offers",
                "Perfectly formatted dates, money, checkboxes",
                "Copy-paste ready",
                "Secure, encrypted, SOC 2 ready",
                "Built by TCs, for TCs"
              ].map((feature) => (
                <Card key={feature} className="p-6">
                  <CheckCircle2 className="h-8 w-8 text-green-500 mb-4" />
                  <p className="text-lg">{feature}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-24">
          <div className="container mx-auto px-4 text-center">
            <h3 className="text-4xl font-bold mb-8">Simple, Transparent Pricing</h3>
            <div className="grid md:grid-cols-2 max-w-4xl mx-auto gap-8">
              <Card className="p-8">
                <h4 className="text-2xl font-bold mb-4">Free Trial</h4>
                <p className="text-4xl font-bold mb-6">$0</p>
                <ul className="space-y-3 text-left">
                  <li>1 free extraction</li>
                  <li>Full RPA parsing</li>
                  <li>Restricted to CA for now</li>
                </ul>
              </Card>
              <Card className="p-8 border-primary">
                <h4 className="text-2xl font-bold mb-4">Pro Monthly</h4>
                <p className="text-4xl font-bold mb-2">$9.99<span className="text-lg font-normal">/month</span></p>
                <p className="text-muted-foreground mb-6">10 credits • Auto-renew</p>
                <SignUpButton mode="redirect">
                  <Button size="lg" className="w-full">Subscribe Now</Button>
                </SignUpButton>
                <p className="mt-4 text-sm text-muted-foreground">
                  + $5 for 5 extra credits anytime
                </p>
              </Card>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-12 mt-24">
  <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
    <div className="flex flex-col sm:flex-row justify-center items-center gap-2 sm:gap-6">
      <p>© 2025 TC Helper. All rights reserved.</p>

      <div className="flex gap-6">
        <a
          href="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition"
        >
          Privacy Policy & California Rights
        </a>

        <a
          href="/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition"
        >
          Terms of Service
        </a>
      </div>
    </div>
  </div>
</footer>
    </div>
  );
}
