-- Add soft delete fields to Pet, RescueSquad, and Division models
-- This enables data recovery and maintains audit trails

-- Add soft delete fields to Pet model
ALTER TABLE "Pet" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Pet" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Pet_isDeleted_idx" ON "Pet"("isDeleted");

-- Add soft delete fields to RescueSquad model
ALTER TABLE "RescueSquad" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RescueSquad" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "RescueSquad_isDeleted_idx" ON "RescueSquad"("isDeleted");

-- Add soft delete fields to Division model
ALTER TABLE "Division" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Division" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Division_isDeleted_idx" ON "Division"("isDeleted");
