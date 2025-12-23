-- CreateTable
CREATE TABLE "user_zammad_mappings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "zammadUserId" INTEGER NOT NULL,
    "zammadUserEmail" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "uploaded_files" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "bucketName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "referenceType" TEXT NOT NULL,
    "referenceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

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
