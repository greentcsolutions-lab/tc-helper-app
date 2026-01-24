// src/app/privacy/page.tsx
// version 1.4.0 01/19/2026

import { SiteFooter } from "@/components/layout/SiteFooter";

export const metadata = {
  title: "Privacy Policy | TC Helper App",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <header className="mb-12 border-b pb-8">
        <h1 className="text-4xl font-bold mb-4">Privacy Policy</h1>
        <p className="text-muted-foreground">Last Updated: January 24, 2026</p>
      </header>

      <div className="prose prose-slate max-w-none dark:prose-invert">

        <section>
          <h2>1. Introduction</h2>
          <p>
            TC Helper App ("we," "us," or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and handle your information when you use our services, including our integration with Google Calendar.
          </p>
        </section>

        {/* MANDATORY GOOGLE DISCLOSURE SECTION */}
        <section className="bg-muted/50 p-6 rounded-lg border my-8">
          <h2 className="text-xl font-bold mt-0">2. Google API Limited Use Disclosure</h2>
          <p className="text-sm leading-relaxed">
            TC Helper App's use and transfer to any other app of information received from Google APIs will adhere to the{' '}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline"
            >
              Google API Services User Data Policy
            </a>, including the Limited Use requirements.
          </p>
          <ul className="text-sm space-y-2 mt-4">
            <li><strong>No Advertising:</strong> Your Google user data is never used for advertising purposes.</li>
            <li><strong>No Data Selling:</strong> We do not sell your Google user data to third-party data brokers or any other entities.</li>
            <li><strong>Human Review:</strong> No human employees at TC Helper App read your Google Calendar data unless you provide explicit consent for technical support, or it is necessary for security purposes (such as investigating a bug or system abuse).</li>
          </ul>
        </section>

        <section>
          <h2>3. Google Calendar Integration & Data Usage</h2>
          <p>
            When you enable Google Calendar sync, TC Helper App requests access to specific scopes (<code>https://www.googleapis.com/auth/calendar</code> and <code>https://www.googleapis.com/auth/calendar.events</code>) to provide the following features:
          </p>
          <ul>
            <li><strong>Event Creation:</strong> We create a dedicated "TC Helper - Transactions" calendar to post transaction deadlines (e.g., "Inspection Period Ends").</li>
            <li><strong>Bidirectional Sync:</strong> We monitor the "TC Helper - Transactions" calendar so that if you manually update a deadline date within your Google Calendar app, the change is synced back to your TC Helper dashboard.</li>
            <li><strong>Data Minimization:</strong> We do not access, read, or modify your primary personal calendar or any other secondary calendars not created by our service.</li>
          </ul>
        </section>

        <section>
          <h2>4. AI Data Processing Disclosure</h2>
          <p>
            TC Helper App uses Artificial Intelligence for the following purposes:
          </p>

          <h3 className="text-lg font-semibold mt-4">PDF Contract Extraction</h3>
          <p>
            We use AI (Anthropic Claude and Google Gemini) strictly for extracting data from uploaded PDF real estate contracts.
          </p>
          <ul>
            <li><strong>No Training:</strong> We utilize enterprise-tier API agreements which strictly prohibit the use of customer data for training AI models.</li>
            <li><strong>Transient Processing:</strong> Your PDFs are processed in-memory and are not retained by our AI providers after the extraction is complete.</li>
          </ul>

          <h3 className="text-lg font-semibold mt-4">Calendar Event Categorization</h3>
          <p>
            Calendar event titles and descriptions from your "TC Helper - Transactions" calendar are processed by Google Gemini AI to automatically categorize tasks (timeline, broker, escrow, lender). We do NOT send calendar data to Anthropic Claude. This inference feature helps organize your deadlines automatically.
          </p>
          <ul>
            <li><strong>Scope:</strong> Only events in the "TC Helper - Transactions" calendar we created are processed.</li>
            <li><strong>Purpose:</strong> To automatically assign task categories and improve organization.</li>
            <li><strong>No Training:</strong> This data is not used to train AI models.</li>
          </ul>
        </section>

        <section>
          <h2>5. Data Retention & Deletion</h2>

          <h3 className="text-lg font-semibold mt-4">PDF Files</h3>
          <p>
            Uploaded PDF files are automatically deleted from our servers immediately upon page close or within 2 hours, whichever comes first. A cron job runs every 2 hours as a safety net to ensure all temporary PDFs are removed from Vercel Blob storage.
          </p>

          <h3 className="text-lg font-semibold mt-4">Extracted Contract Data</h3>
          <p>
            Structured data extracted from your PDFs is retained in our encrypted database until you choose to delete the transaction or close your account.
          </p>

          <h3 className="text-lg font-semibold mt-4">Google Calendar Metadata</h3>
          <p>
            We store the following metadata to maintain calendar synchronization:
          </p>
          <ul>
            <li>Google OAuth tokens (encrypted)</li>
            <li>Calendar IDs and Event IDs</li>
            <li>Webhook identifiers for real-time updates</li>
            <li>Event titles, descriptions, dates, and times</li>
            <li>AI-inferred task categorizations</li>
            <li>Sync tokens for efficient incremental updates</li>
          </ul>

          <h3 className="text-lg font-semibold mt-4">User Control & Deletion</h3>
          <ul>
            <li><strong>Revoke Access:</strong> You may revoke TC Helper App's access to your Google account at any time via <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="underline">Google Security Settings</a>.</li>
            <li><strong>30-Day Deletion:</strong> Upon disconnection of the calendar sync service, all stored Google API metadata is permanently deleted from our active databases within 30 days.</li>
            <li><strong>Account Termination:</strong> If you delete your account, all associated data is immediately removed.</li>
          </ul>
        </section>

        <section>
          <h2>6. Security</h2>
          <p>
            We implement industry-standard security measures, including SSL encryption for data in transit and at-rest encryption, to protect your information from unauthorized access.
          </p>
        </section>

        <section>
          <h2>7. Contact Us</h2>
          <p>
            For questions regarding this policy or to request data deletion, please contact:
          </p>
          <p className="font-medium">
            TC Helper App<br />
            Email: <a href="mailto:info@tchelper.app" className="underline">info@tchelper.app</a><br />
            Mountain Grove, Missouri 65711
          </p>
        </section>
      </div>

      <SiteFooter />
    </div>
  );
}
