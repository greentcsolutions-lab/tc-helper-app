// src/app/terms/page.tsx
// version 1.1.0 01/19/2026

import { SiteFooter } from "@/components/layout/SiteFooter";

export const metadata = {
  title: "Terms of Service | TC Helper App",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <header className="mb-12 border-b pb-8">
        <h1 className="text-4xl font-bold mb-4">Terms of Service</h1>
        <p className="text-muted-foreground">Last Revised: January 19, 2026</p>
      </header>

      <div className="prose prose-slate max-w-none dark:prose-invert">
        <section>
          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using TC Helper App (“the Service”), you agree to be bound by these Terms. 
            The Service is operated from <strong>Mountain Grove, Missouri</strong>. If you do not agree 
            to these terms, do not use the Service.
          </p>
        </section>

        <section className="bg-red-50 dark:bg-red-950/20 p-6 rounded-lg border border-red-200 dark:border-red-900">
          <h2 className="text-red-800 dark:text-red-400 mt-0 text-xl font-bold">2. AI Accuracy & Professional Disclaimer</h2>
          <p>
            <strong>The "Verify Everything" Rule:</strong> TC Helper App uses advanced Artificial Intelligence (Anthropic Claude and Google Gemini) to extract data from real estate contracts. AI is subject to "hallucinations" and may occasionally produce incorrect dates, prices, or names.
          </p>
          <ul className="text-sm space-y-2">
            <li><strong>User Responsibility:</strong> You are 100% responsible for verifying the accuracy of all extracted data before relying on it for business purposes or deadlines.</li>
            <li><strong>Not Legal Advice:</strong> TC Helper App is an administrative tool only. We are not licensed real estate brokers, attorneys, or legal counsel. Use of this app does not constitute professional real estate or legal advice.</li>
          </ul>
        </section>

        <section>
          <h2>3. Subscription, Whop Payments, & Refunds</h2>
          <p>
            Our billing is managed through <strong>Whop</strong>. 
          </p>
          <ul>
            <li><strong>Refunds:</strong> We offer a full 14-day money-back guarantee, provided that no AI extraction credits have been consumed. Once an AI extraction is performed, the costs are non-refundable.</li>
            <li><strong>Cancellations:</strong> You may cancel your subscription at any time. You will retain access to the Service until the conclusion of your current billing period.</li>
            <li><strong>Accounts:</strong> Access is granted on a "one seat per user" basis. Account sharing is strictly prohibited.</li>
          </ul>
        </section>

        <section>
          <h2>4. Data Ownership & Google Integration</h2>
          <ul>
            <li><strong>Ownership:</strong> You retain full ownership of all PDFs uploaded and the resulting data processed by the Service.</li>
            <li><strong>License to Process:</strong> You grant TC Helper App a limited, temporary license to process your documents through our AI sub-processors solely to provide the extraction service.</li>
            <li><strong>Google Calendar:</strong> By enabling Google Calendar sync, you authorize the Service to read and write to a dedicated "TC Helper" calendar. We are not responsible for sync delays, missed notifications, or errors within the Google Calendar interface.</li>
          </ul>
        </section>

        <section>
          <h2>5. Limitation of Liability</h2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, TC HELPER APP SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES (INCLUDING LOST COMMISSIONS, MISSED CONTRACT DEADLINES, OR LEGAL DISPUTES) ARISING FROM YOUR USE OF THE SERVICE. 
          </p>
        </section>

        <section>
          <h2>6. Termination & Governing Law</h2>
          <p>
            We reserve the right to terminate or suspend your account immediately, without prior notice, for conduct that we believe violates these Terms.
          </p>
          <p>
            <strong>Arbitration & Law:</strong> These terms are governed by the laws of the <strong>State of Missouri</strong>. Any disputes arising from these terms or the use of the Service shall be resolved through binding arbitration conducted in <strong>Wright County, Missouri</strong>.
          </p>
        </section>

        <section className="pt-8 border-t">
          <h2>7. Contact</h2>
          <p>
            For support or legal inquiries: <strong>greentcsolutions@gmail.com</strong><br />
            Mountain Grove, Missouri 65711
          </p>
        </section>
      </div>

      <SiteFooter />
    </div>
  );
}
