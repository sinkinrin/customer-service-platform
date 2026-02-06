-- CreateTable
CREATE TABLE "faq_categories" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faq_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faq_articles" (
    "id" SERIAL NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "slug" TEXT NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faq_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faq_article_translations" (
    "id" SERIAL NOT NULL,
    "articleId" INTEGER NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "keywords" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faq_article_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faq_ratings" (
    "id" SERIAL NOT NULL,
    "articleId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "isHelpful" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "faq_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_zammad_mappings" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "zammadUserId" INTEGER NOT NULL,
    "zammadUserEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_zammad_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uploaded_files" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bucketName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "referenceType" TEXT NOT NULL,
    "referenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "uploaded_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_ratings" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reply_templates" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "region" TEXT,
    "createdById" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reply_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_updates" (
    "id" TEXT NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "event" TEXT NOT NULL,
    "data" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "faq_categories_slug_key" ON "faq_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "faq_articles_slug_key" ON "faq_articles"("slug");

-- CreateIndex
CREATE INDEX "faq_articles_categoryId_idx" ON "faq_articles"("categoryId");

-- CreateIndex
CREATE INDEX "faq_article_translations_articleId_idx" ON "faq_article_translations"("articleId");

-- CreateIndex
CREATE INDEX "faq_article_translations_locale_idx" ON "faq_article_translations"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "faq_article_translations_articleId_locale_key" ON "faq_article_translations"("articleId", "locale");

-- CreateIndex
CREATE INDEX "faq_ratings_articleId_idx" ON "faq_ratings"("articleId");

-- CreateIndex
CREATE UNIQUE INDEX "faq_ratings_articleId_userId_key" ON "faq_ratings"("articleId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_zammad_mappings_userId_key" ON "user_zammad_mappings"("userId");

-- CreateIndex
CREATE INDEX "user_zammad_mappings_userId_idx" ON "user_zammad_mappings"("userId");

-- CreateIndex
CREATE INDEX "user_zammad_mappings_zammadUserId_idx" ON "user_zammad_mappings"("zammadUserId");

-- CreateIndex
CREATE INDEX "uploaded_files_userId_idx" ON "uploaded_files"("userId");

-- CreateIndex
CREATE INDEX "uploaded_files_referenceType_referenceId_idx" ON "uploaded_files"("referenceType", "referenceId");

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

-- CreateIndex
CREATE INDEX "notifications_userId_read_idx" ON "notifications"("userId", "read");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_type_idx" ON "notifications"("type");

-- AddForeignKey
ALTER TABLE "faq_articles" ADD CONSTRAINT "faq_articles_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "faq_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faq_article_translations" ADD CONSTRAINT "faq_article_translations_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "faq_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faq_ratings" ADD CONSTRAINT "faq_ratings_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "faq_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
