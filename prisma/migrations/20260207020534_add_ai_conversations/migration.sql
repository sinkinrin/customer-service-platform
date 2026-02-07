-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderRole" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "messageType" TEXT NOT NULL DEFAULT 'text',
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_message_ratings" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" TEXT NOT NULL,
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_message_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_conversations_customerId_idx" ON "ai_conversations"("customerId");

-- CreateIndex
CREATE INDEX "ai_conversations_customerEmail_idx" ON "ai_conversations"("customerEmail");

-- CreateIndex
CREATE INDEX "ai_conversations_status_idx" ON "ai_conversations"("status");

-- CreateIndex
CREATE INDEX "ai_messages_conversationId_idx" ON "ai_messages"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_message_ratings_messageId_key" ON "ai_message_ratings"("messageId");

-- CreateIndex
CREATE INDEX "ai_message_ratings_userId_idx" ON "ai_message_ratings"("userId");

-- CreateIndex
CREATE INDEX "ai_message_ratings_rating_idx" ON "ai_message_ratings"("rating");

-- CreateIndex
CREATE UNIQUE INDEX "ai_message_ratings_messageId_userId_key" ON "ai_message_ratings"("messageId", "userId");

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_message_ratings" ADD CONSTRAINT "ai_message_ratings_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ai_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
