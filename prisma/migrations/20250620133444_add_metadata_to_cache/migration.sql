/*
  Warnings:

  - You are about to drop the `Cache` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `role` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "verificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- AlterTable
ALTER TABLE "Disaster" ALTER COLUMN "auditTrail" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "role" SET NOT NULL;

-- DropTable
DROP TABLE "Cache";

-- CreateTable
CREATE TABLE "cache" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "accessCount" INTEGER NOT NULL DEFAULT 1,
    "lastAccessed" TIMESTAMP(3),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB DEFAULT '{}',

    CONSTRAINT "cache_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "cache_expiresAt_idx" ON "cache"("expiresAt");

-- CreateIndex
CREATE INDEX "cache_tags_idx" ON "cache"("tags");

-- CreateIndex
CREATE INDEX "cache_accessCount_idx" ON "cache"("accessCount" DESC);

-- CreateIndex
CREATE INDEX "cache_createdAt_idx" ON "cache"("createdAt" DESC);
