-- AddColumn
ALTER TABLE "ai_messages" ADD COLUMN "aiRequestId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ai_messages_conversationId_aiRequestId_key"
ON "ai_messages"("conversationId", "aiRequestId");
