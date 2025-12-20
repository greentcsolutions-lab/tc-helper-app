// src/app/privacy/page.tsx
import Link from "next/link";

export const metadata = {
  title: "Privacy Policy & California Rights",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground mb-12">Last updated: December 5, 2025</p>

      <div className="prose prose-lg dark:prose-invert space-y-8">
        <section>
          <h2>1. What We Do (In Plain English)</h2>
          <p>
            You upload a real estate purchase contract (purchase agreement, counters, disclosures, etc.).
            We turn it into images, run Grok vision over the critical pages, and give you back a clean JSON
            with price, buyer/seller names, dates, contingencies, etc. That’s it.
          </p>
        </section>

        <section>
          <h2>2. Data Flow & Deletion Timeline</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>PDF arrives → instantly flattened in memory with pdf-lib (no storage)</li>
            <li>Static PDF sent to Nutriend API → converted to PNGs → auto-deleted within 10 minutes</li>
            <li>PNGs sent to xAI Grok (U.S.) → vision extraction → deleted after extraction completes</li>
            <li>Original PDF buffer deleted from our database the second extraction finishes</li>
            <li>Final extracted JSON kept only while you need it (you can delete anytime)</li>
          </ul>
        </section>

        <section>
          <h2>3. We <strong>Never</strong></h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Sell, rent, or share your documents or personal information</li>
            <li>Use your PDFs or images to train any AI models</li>
            <li>Keep your PDF files longer than the ~90 seconds needed to process them</li>
          </ul>
        </section>

        <section>
          <h2>4. California Consumer Privacy Act (CCPA/CPRA) Rights</h2>
          <p>You have the right to:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Know exactly what personal information we collected</li>
            <li>Delete your data (including any past parses)</li>
            <li>Opt-out of sale or sharing (we don’t sell or share — but the right is honored)</li>
            <li>Limit use of Sensitive Personal Information (addresses, financial data, etc.)</li>
            <li>Not be discriminated against for exercising these rights</li>
          </ul>
          <p className="mt-4">
            To exercise any right, email us at <strong>info@tchelper.app</strong>.
            We will respond within 30 days.
          </p>
        </section>

        <section>
          <h2>5. Contact & Data Protection Officer</h2>
          <p>
            Questions? Reach us at{" "}
            <a href="mailto:info@tchelper.app" className="underline">
              info@tchelper.app
            </a>
          </p>
        </section>
      </div>

      <div className="mt-16 text-center">
        <Link href="/" className="text-primary underline">
          ← Back to app
        </Link>
      </div>
    </div>
  );
}