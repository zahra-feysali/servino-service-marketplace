-- CreateEnum
CREATE TYPE "FeaturedSource" AS ENUM ('ADMIN', 'PURCHASE');

-- AlterTable
ALTER TABLE "FeaturedProvider" ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "planId" UUID,
ADD COLUMN     "source" "FeaturedSource" NOT NULL DEFAULT 'ADMIN';

-- CreateTable
CREATE TABLE "FeaturedPlan" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "description" VARCHAR(300),
    "placement" "FeaturedPlacement" NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeaturedPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeaturedPlan_slug_key" ON "FeaturedPlan"("slug");

-- CreateIndex
CREATE INDEX "FeaturedPlan_isActive_sortOrder_idx" ON "FeaturedPlan"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "FeaturedProvider_providerId_placement_isActive_endsAt_idx" ON "FeaturedProvider"("providerId", "placement", "isActive", "endsAt");

-- AddForeignKey
ALTER TABLE "FeaturedProvider" ADD CONSTRAINT "FeaturedProvider_planId_fkey" FOREIGN KEY ("planId") REFERENCES "FeaturedPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
