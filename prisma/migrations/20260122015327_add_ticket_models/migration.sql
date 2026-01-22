-- CreateTable
CREATE TABLE "ticket_ratings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ticketId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "reply_templates" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "region" TEXT,
    "createdById" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ticket_updates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" INTEGER NOT NULL,
    "event" TEXT NOT NULL,
    "data" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "ticket_ratings_ticketId_key" ON "ticket_ratings"("ticketId");

-- CreateIndex
CREATE INDEX "ticket_ratings_ticketId_idx" ON "ticket_ratings"("ticketId");

-- CreateIndex
CREATE INDEX "ticket_ratings_userId_idx" ON "ticket_ratings"("userId");

-- CreateIndex
CREATE INDEX "ticket_ratings_rating_idx" ON "ticket_ratings"("rating");

-- CreateIndex
CREATE INDEX "reply_templates_category_idx" ON "reply_templates"("category");

-- CreateIndex
CREATE INDEX "reply_templates_region_idx" ON "reply_templates"("region");

-- CreateIndex
CREATE INDEX "reply_templates_isActive_idx" ON "reply_templates"("isActive");

-- CreateIndex
CREATE INDEX "ticket_updates_ticketId_idx" ON "ticket_updates"("ticketId");

-- CreateIndex
CREATE INDEX "ticket_updates_createdAt_idx" ON "ticket_updates"("createdAt");
