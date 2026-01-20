// src/app/privacy/page.tsx
// version 1.4.0 01/19/2026

import { SiteFooter } from "@/components/layout/SiteFooter";

export const metadata = {
  title: "Privacy Policy | Google API Disclosure | TC Helper App",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <header className="mb-12 border-b pb-8">
        <h1 className="text-4xl font-bold mb-4">Privacy Policy</h1>
        <p className="text-muted-foreground">Effective Date: January 19, 2026</p>
      </header>

      <div className="prose prose-slate max-w-none dark:prose-invert">
        
        {/* 1. MANDATORY GOOGLE DISCLOSURE SECTION */}
        <section className="bg-muted/50 p-6 rounded-lg border mb-10">
          <h2 className="text-xl font-bold mt-0">Google API Limited Use Disclosure</h2>
          <p className="text-sm leading-relaxed">
            TC Helper App’s use and transfer to any other app of information received from Google APIs will adhere to 
            <a 
              href="https://developers.google.com/terms/api-services-user-data-policy#additional_requirements_for_specific_api_scopes" 
              target="_blank" 
              rel="noopener noreferrer"
              className="font-semibold underline ml-1"
            >
              Google API Service User Data Policy
            </a>, including the Limited Use requirements.
          </p>
          <ul className="text-sm space-y-2 mt-4">
            <li><strong>Data Minimization:</strong> We only request access to the specific Google Calendar scopes required to sync your transaction deadlines.</li>
            <li><strong>No Human Read:</strong> No human employees at TC Helper App read your Google Calendar data unless specifically requested by you for technical support purposes.</li>
            <li><strong>No Advertising:</strong> Your Google user data is never used for advertising, nor is it sold to third-party "data brokers."</li>
          </ul>
        </section>

        <section>
          <h2>2. AI Data Processing (Anthropic & Google Gemini)</h2>
          <p>
            To provide real-time contract extraction, we utilize a "racing" architecture between <strong>Anthropic (Claude)</strong> and <strong>Google (Gemini)</strong>. 
          </p>
          <ul>
            <li>Data is sent via secure, encrypted API endpoints.</li>
            <li><strong>Zero Training:</strong> We use enterprise API tiers which strictly prohibit the use of customer data for model training.</li>
            <li><strong>Transient Processing:</strong> Your PDFs are processed in-memory and are not retained by our AI sub-processors after the extraction is complete.</li>
          </ul>
        </section>

        <section>
          <h2>3. Bidirectional Calendar Sync</h2>
          <p>
            When you enable Google Calendar integration, TC Helper App performs the following:
          </p>
          <ul>
            <li><strong>Write Access:</strong> We create a "TC Helper" calendar to post deadlines (e.g., "Inspection Period Ends") so they appear in your mobile/desktop calendar apps.</li>
            <li><strong>Read Access:</strong> We monitor the "TC Helper" calendar. If you modify a deadline date within your Google Calendar app, we sync that update back to your TC Helper dashboard.</li>
            <li><strong>Authentication:</strong> We use OAuth 2.0. We never see or store your Google password.</li>
          </ul>
        </section>

        <section>
          <h2>4. Data Retention</h2>
          <ul>
            <li><strong>PDFs:</strong> Automatically deleted from our servers within 30 seconds of processing.</li>
            <li><strong>Extracted Records:</strong> Retained in our encrypted database until you choose to delete the transaction or close your account.</li>
            <li><strong>Google Metadata:</strong> We store Google-returned "Event IDs" and "Calendar IDs" to maintain the sync connection.</li>
          </ul>
        </section>

        <section>
          <h2>5. Contact & CCPA Compliance</h2>
          <p>
            Residents of California have specific rights regarding data access and deletion under the CCPA. 
            To exercise these rights, or for any questions, please contact:
          </p>
          <p className="font-medium">
            TC Helper App <br />
            Email: <a href="mailto:info@tchelper.app">info@tchelper.app</a> <br />
            Location: Mountain Grove, Missouri
          </p>
        </section>
      </div>

      <SiteFooter />
    </div>
  );
}
