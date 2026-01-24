-- CreateTable
CREATE TABLE "communications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'email',
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT,
    "bodyText" TEXT,
    "bodyHtml" TEXT,
    "attachments" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "rejectionReason" TEXT,
    "errorMessage" TEXT,
    "parseId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "communications_userId_createdAt_idx" ON "communications"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "communications_userId_status_idx" ON "communications"("userId", "status");

-- CreateIndex
CREATE INDEX "communications_direction_createdAt_idx" ON "communications"("direction", "createdAt");

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_parseId_fkey" FOREIGN KEY ("parseId") REFERENCES "parses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
