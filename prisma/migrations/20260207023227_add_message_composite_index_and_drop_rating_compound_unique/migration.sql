-- DropIndex
DROP INDEX "ai_message_ratings_messageId_userId_key";

-- CreateIndex
CREATE INDEX "ai_messages_conversationId_createdAt_idx" ON "ai_messages"("conversationId", "createdAt");
