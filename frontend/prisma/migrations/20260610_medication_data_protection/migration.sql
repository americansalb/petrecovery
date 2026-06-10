-- AlterTable
ALTER TABLE "MedicationDose" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PetMedication" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "MedicationAuditLog" (
    "id" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "medicationId" TEXT,
    "doseId" TEXT,
    "action" TEXT NOT NULL,
    "actorUserId" TEXT,
    "snapshot" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MedicationAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MedicationAuditLog_petId_createdAt_idx" ON "MedicationAuditLog"("petId", "createdAt");

-- CreateIndex
CREATE INDEX "MedicationAuditLog_medicationId_idx" ON "MedicationAuditLog"("medicationId");

-- CreateIndex
CREATE INDEX "PetMedication_petId_deletedAt_idx" ON "PetMedication"("petId", "deletedAt");

