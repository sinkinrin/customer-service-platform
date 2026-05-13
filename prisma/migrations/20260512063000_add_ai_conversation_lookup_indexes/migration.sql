-- CreateIndex
CREATE INDEX "ai_conversations_customerId_status_idx" ON "ai_conversations"("customerId", "status");

-- CreateIndex
CREATE INDEX "ai_conversations_customerId_lastMessageAt_idx" ON "ai_conversations"("customerId", "lastMessageAt");
