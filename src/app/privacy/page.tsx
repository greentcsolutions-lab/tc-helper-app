// src/app/privacy/page.tsx
// version 1.2.0 01/09/2026

import Link from "next/link";

export const metadata = {
  title: "Privacy Policy & California Rights",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground mb-12">Last updated: January 7, 2026</p>

      <div className="prose prose-lg dark:prose-invert space-y-8">
        <section>
          <h2>1. What We Do (In Plain English)</h2>
          <p>
            You upload a PDF (typically a real estate contract). We extract structured data (price, names,
            dates, contingencies, etc.) using Mistral AI. After extraction, you can view and manage the
            resulting structured data in the app.
          </p>
        </section>

        <section>
          <h2>2. Data Flow & Deletion Timeline</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>PDF uploaded directly to our service (no public sharing).</li>
            <li>Uploaded PDFs and any derived images are deleted immediately after extraction completes (typically within ~30 seconds).</li>
            <li>The extracted JSON and any user-saved artifacts are retained only so you can interact with them in the app; you can delete them anytime.</li>
          </ul>
        </section>

        <section>
          <h2>3. We <strong>Never</strong></h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Sell, rent, or share your documents or personal information to third parties for profit.</li>
            <li>Use your uploaded PDFs or derived images to train our models or third-party models.</li>
            <li>Keep your original PDFs after extraction completes.</li>
          </ul>
        </section>

        <section>
          <h2>4. California Consumer Privacy Act (CCPA/CPRA) Rights</h2>
          <p>You have the right to:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Know what personal information we collected about you.</li>
            <li>Request deletion of your personal information (including past parses).</li>
            <li>Opt-out of any future sale or sharing (we do not sell or share customer data).</li>
            <li>Limit use of Sensitive Personal Information.</li>
            <li>Not be discriminated against for exercising these rights.</li>
          </ul>
          <p className="mt-4">
            To exercise any right, email <strong>info@tchelper.app</strong>. We will respond within 30 days.
          </p>
        </section>

        <section>
          <h2>5. Contact & Data Protection</h2>
          <p>
            Questions about privacy or data handling? Contact us at{" "}
            <a href="mailto:info@tchelper.app" className="underline">
              info@tchelper.app
            </a>
            . We take data protection seriously and limit access to only what is necessary for processing.
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
