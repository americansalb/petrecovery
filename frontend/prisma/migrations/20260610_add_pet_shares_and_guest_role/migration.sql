-- CreateEnum
CREATE TYPE "PetShareRole" AS ENUM ('CAREGIVER', 'VIEWER');

-- CreateEnum
CREATE TYPE "PetShareStatus" AS ENUM ('PENDING', 'ACTIVE');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'GUEST';

-- CreateTable
CREATE TABLE "PetShare" (
    "id" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "userId" TEXT,
    "role" "PetShareRole" NOT NULL DEFAULT 'CAREGIVER',
    "status" "PetShareStatus" NOT NULL DEFAULT 'PENDING',
    "invitedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "PetShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PetShare_userId_idx" ON "PetShare"("userId");

-- CreateIndex
CREATE INDEX "PetShare_email_idx" ON "PetShare"("email");

-- CreateIndex
CREATE INDEX "PetShare_petId_idx" ON "PetShare"("petId");

-- CreateIndex
CREATE UNIQUE INDEX "PetShare_petId_email_key" ON "PetShare"("petId", "email");

-- AddForeignKey
ALTER TABLE "PetShare" ADD CONSTRAINT "PetShare_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PetShare" ADD CONSTRAINT "PetShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PetShare" ADD CONSTRAINT "PetShare_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

