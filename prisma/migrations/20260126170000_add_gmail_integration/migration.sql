-- CreateTable: GmailSettings
-- Gmail integration for Comms Center

CREATE TABLE "gmail_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "googleAccessToken" TEXT,
    "googleRefreshToken" TEXT,
    "googleTokenExpiry" TIMESTAMP(3),
    "primaryEmailAddress" TEXT,
    "tcHelperLabelId" TEXT,
    "webhookHistoryId" TEXT,
    "webhookExpiration" TIMESTAMP(3),
    "useCustomSignature" BOOLEAN NOT NULL DEFAULT false,
    "customSignature" TEXT,
    "lastSyncStatus" TEXT,
    "lastSyncError" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "disconnectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gmail_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Unique constraint on userId
CREATE UNIQUE INDEX "gmail_settings_userId_key" ON "gmail_settings"("userId");

-- AddForeignKey: Link to users table
ALTER TABLE "gmail_settings" ADD CONSTRAINT "gmail_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: SentEmail
-- Audit trail for emails sent via TC Helper

CREATE TABLE "sent_emails" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gmailMessageId" TEXT,
    "gmailThreadId" TEXT,
    "to" TEXT[],
    "cc" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bcc" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "subject" TEXT NOT NULL,
    "bodyText" TEXT,
    "bodyHtml" TEXT,
    "attachmentsMeta" JSONB,
    "parseId" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentVia" TEXT NOT NULL DEFAULT 'gmail',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sent_emails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: For querying sent emails by user
CREATE INDEX "sent_emails_userId_sentAt_idx" ON "sent_emails"("userId", "sentAt");

-- CreateIndex: For finding emails in the same thread
CREATE INDEX "sent_emails_gmailThreadId_idx" ON "sent_emails"("gmailThreadId");

-- AddForeignKey: Link to users table
ALTER TABLE "sent_emails" ADD CONSTRAINT "sent_emails_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Link to parses table (transactions)
ALTER TABLE "sent_emails" ADD CONSTRAINT "sent_emails_parseId_fkey" FOREIGN KEY ("parseId") REFERENCES "parses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
