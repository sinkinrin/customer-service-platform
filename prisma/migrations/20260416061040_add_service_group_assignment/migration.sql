-- CreateEnum
CREATE TYPE "ServiceBaseRegion" AS ENUM ('AFRICA', 'MIDDLE_EAST', 'ASIA_PACIFIC', 'NORTH_AMERICA', 'LATIN_AMERICA', 'EUROPE_ZONE_1', 'EUROPE_ZONE_2', 'CIS');

-- CreateTable
CREATE TABLE "service_groups" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "baseRegion" "ServiceBaseRegion" NOT NULL,
    "staffZammadId" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_group_assignments" (
    "id" SERIAL NOT NULL,
    "customerZammadId" INTEGER NOT NULL,
    "serviceGroupId" INTEGER NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "assignedBy" TEXT,

    CONSTRAINT "customer_group_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_groups_name_key" ON "service_groups"("name");

-- CreateIndex
CREATE INDEX "service_groups_staffZammadId_idx" ON "service_groups"("staffZammadId");

-- CreateIndex
CREATE INDEX "service_groups_baseRegion_isActive_idx" ON "service_groups"("baseRegion", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "customer_group_assignments_customerZammadId_key" ON "customer_group_assignments"("customerZammadId");

-- CreateIndex
CREATE INDEX "customer_group_assignments_serviceGroupId_idx" ON "customer_group_assignments"("serviceGroupId");

-- AddForeignKey
ALTER TABLE "customer_group_assignments" ADD CONSTRAINT "customer_group_assignments_serviceGroupId_fkey" FOREIGN KEY ("serviceGroupId") REFERENCES "service_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
