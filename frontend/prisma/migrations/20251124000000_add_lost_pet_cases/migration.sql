-- CreateEnum: LostPetCaseStatus
CREATE TYPE "LostPetCaseStatus" AS ENUM ('OPEN', 'ACTIVE_SEARCH', 'RESOLVED', 'CLOSED_OTHER');

-- CreateTable: LostPetCase
CREATE TABLE "LostPetCase" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "caseNumber" TEXT NOT NULL,
    "petName" TEXT,
    "petSpecies" "PetSpecies" NOT NULL,
    "petBreed" TEXT,
    "petColor" TEXT,
    "petDescription" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zipCode" TEXT,
    "lastSeenLandmark" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "status" "LostPetCaseStatus" NOT NULL DEFAULT 'OPEN',
    "statusReason" TEXT,
    "isUrgent" BOOLEAN NOT NULL DEFAULT false,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "createdById" TEXT NOT NULL,
    "squadId" TEXT,

    CONSTRAINT "LostPetCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable: LostPetCaseNote
CREATE TABLE "LostPetCaseNote" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "caseId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'NOTE',
    "content" TEXT NOT NULL,
    "metadata" TEXT NOT NULL DEFAULT '{}',

    CONSTRAINT "LostPetCaseNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LostPetCase_caseNumber_key" ON "LostPetCase"("caseNumber");

-- CreateIndex
CREATE INDEX "LostPetCase_city_state_idx" ON "LostPetCase"("city", "state");

-- CreateIndex
CREATE INDEX "LostPetCase_status_idx" ON "LostPetCase"("status");

-- CreateIndex
CREATE INDEX "LostPetCase_squadId_idx" ON "LostPetCase"("squadId");

-- CreateIndex
CREATE INDEX "LostPetCaseNote_caseId_idx" ON "LostPetCaseNote"("caseId");

-- AddForeignKey
ALTER TABLE "LostPetCase" ADD CONSTRAINT "LostPetCase_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LostPetCase" ADD CONSTRAINT "LostPetCase_squadId_fkey" FOREIGN KEY ("squadId") REFERENCES "RescueSquad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LostPetCaseNote" ADD CONSTRAINT "LostPetCaseNote_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "LostPetCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LostPetCaseNote" ADD CONSTRAINT "LostPetCaseNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
