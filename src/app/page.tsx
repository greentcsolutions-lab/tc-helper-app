// src/app/page.tsx
// changing comment for git push
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";
import { currentUser } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";

export default async function Home() {
  const user = await currentUser(); // ← this is server-side, safe in App Router

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
              <>
                <Button variant="ghost" asChild>
                  <Link href="/sign-in">Sign In</Link>
                </Button>
                <Button asChild>
                  <Link href="/sign-up">Get Started Free</Link>
                </Button>
              </>
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
            <Button size="lg" asChild>
              <Link href="/sign-up">Start Free → 1 Credit Included</Link>
            </Button>
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
                  <li>✓ 1 free extraction</li>
                  <li>✓ Full RPA parsing</li>
                  <li>✓ Restricted to CA for now</li>
                </ul>
              </Card>
              <Card className="p-8 border-primary">
                <h4 className="text-2xl font-bold mb-4">Pro Monthly</h4>
                <p className="text-4xl font-bold mb-2">$9.99<span className="text-lg font-normal">/month</span></p>
                <p className="text-muted-foreground mb-6">10 credits • Auto-renew</p>
                <Button size="lg" className="w-full" asChild>
                  <Link href="/sign-up">Subscribe Now</Link>
                </Button>
                <p className="mt-4 text-sm text-muted-foreground">
                  + $5 for 5 extra credits anytime
                </p>
              </Card>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-12">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; 2025 TC Helper. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}