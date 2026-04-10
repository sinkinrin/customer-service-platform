-- CreateTable
CREATE TABLE "customer_staff_bindings" (
    "id" SERIAL NOT NULL,
    "customerZammadId" INTEGER NOT NULL,
    "staffZammadId" INTEGER NOT NULL,
    "region" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deactivatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_staff_bindings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_staff_bindings_customerZammadId_key" ON "customer_staff_bindings"("customerZammadId");

-- CreateIndex
CREATE INDEX "customer_staff_bindings_staffZammadId_idx" ON "customer_staff_bindings"("staffZammadId");

-- CreateIndex
CREATE INDEX "customer_staff_bindings_isActive_staffZammadId_idx" ON "customer_staff_bindings"("isActive", "staffZammadId");

-- CreateIndex
CREATE INDEX "customer_staff_bindings_isActive_region_idx" ON "customer_staff_bindings"("isActive", "region");
