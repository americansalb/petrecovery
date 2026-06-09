-- CreateEnum
CREATE TYPE "MedicationForm" AS ENUM ('PILL', 'CAPSULE', 'CHEWABLE', 'LIQUID', 'INJECTION', 'TOPICAL', 'DROPS', 'POWDER', 'OTHER');

-- CreateEnum
CREATE TYPE "MedicationSchedule" AS ENUM ('DAILY', 'SPECIFIC_DAYS', 'EVERY_N_DAYS', 'AS_NEEDED');

-- CreateEnum
CREATE TYPE "DoseStatus" AS ENUM ('GIVEN', 'SKIPPED');

-- CreateTable
CREATE TABLE "PetMedication" (
    "id" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "strength" TEXT,
    "form" "MedicationForm" NOT NULL DEFAULT 'PILL',
    "purpose" TEXT,
    "prescribedBy" TEXT,
    "instructions" TEXT,
    "scheduleType" "MedicationSchedule" NOT NULL DEFAULT 'DAILY',
    "timesOfDay" TEXT NOT NULL DEFAULT '[]',
    "daysOfWeek" TEXT,
    "intervalDays" INTEGER,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "quantityRemaining" DOUBLE PRECISION,
    "refillAlertAt" DOUBLE PRECISION,
    "color" TEXT NOT NULL DEFAULT 'amber',
    "icon" TEXT NOT NULL DEFAULT 'pill',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PetMedication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicationDose" (
    "id" TEXT NOT NULL,
    "medicationId" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "status" "DoseStatus" NOT NULL DEFAULT 'GIVEN',
    "givenAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MedicationDose_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PetMedication_petId_isActive_idx" ON "PetMedication"("petId", "isActive");

-- CreateIndex
CREATE INDEX "MedicationDose_medicationId_scheduledFor_idx" ON "MedicationDose"("medicationId", "scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "MedicationDose_medicationId_scheduledFor_key" ON "MedicationDose"("medicationId", "scheduledFor");

-- AddForeignKey
ALTER TABLE "PetMedication" ADD CONSTRAINT "PetMedication_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationDose" ADD CONSTRAINT "MedicationDose_medicationId_fkey" FOREIGN KEY ("medicationId") REFERENCES "PetMedication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

