-- Phase 22-24: Roles, Permissions & Case Assignment MVP
-- Migration: Add coordinatorId to LostPetCase

-- Add coordinatorId column (nullable, defaults to NULL)
ALTER TABLE "LostPetCase"
  ADD COLUMN "coordinatorId" TEXT NULL;

-- Add index for efficient coordinator views
CREATE INDEX "LostPetCase_coordinatorId_idx" ON "LostPetCase"("coordinatorId");

-- Add foreign key constraint to User table
ALTER TABLE "LostPetCase"
  ADD CONSTRAINT "LostPetCase_coordinatorId_fkey"
  FOREIGN KEY ("coordinatorId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
