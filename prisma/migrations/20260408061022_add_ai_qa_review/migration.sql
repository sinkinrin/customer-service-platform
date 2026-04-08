-- CreateTable
CREATE TABLE "ai_qa_reviews" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reviewNote" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "retestAnswer" TEXT,
    "retestAppId" TEXT,
    "retestAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'platform',
    "appId" TEXT,
    "externalId" TEXT,
    "question" TEXT,
    "answer" TEXT,
    "customerEmail" TEXT,
    "conversationId" TEXT,
    "qaTime" TIMESTAMP(3),

    CONSTRAINT "ai_qa_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_qa_reviews_messageId_key" ON "ai_qa_reviews"("messageId");

-- CreateIndex
CREATE INDEX "ai_qa_reviews_status_idx" ON "ai_qa_reviews"("status");

-- CreateIndex
CREATE INDEX "ai_qa_reviews_messageId_idx" ON "ai_qa_reviews"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_qa_reviews_source_appId_externalId_key" ON "ai_qa_reviews"("source", "appId", "externalId");

-- AddForeignKey
ALTER TABLE "ai_qa_reviews" ADD CONSTRAINT "ai_qa_reviews_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ai_messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
