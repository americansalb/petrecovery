-- AlterTable: Add public visibility flags to LostPetCase
-- Phase 15-16: Public Lost Pet Case Portal MVP

-- Add isPublic flag (controls whether case appears in public listings)
ALTER TABLE "LostPetCase"
  ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false;

-- Add publicContactOk flag (controls whether contact info is shown on public detail page)
ALTER TABLE "LostPetCase"
  ADD COLUMN "publicContactOk" BOOLEAN NOT NULL DEFAULT false;

-- Add source field (tracks whether case was created by admin or public report)
ALTER TABLE "LostPetCase"
  ADD COLUMN "source" TEXT NOT NULL DEFAULT 'ADMIN';

-- Add compound index on (isPublic, status) for efficient public case queries
CREATE INDEX "LostPetCase_isPublic_status_idx" ON "LostPetCase"("isPublic", "status");

-- Migration Notes:
-- 1. All existing cases default to isPublic=false (safe - no existing cases exposed publicly)
-- 2. All existing cases default to publicContactOk=false (safe - contact info protected)
-- 3. All existing cases default to source='ADMIN' (accurate - all current cases are admin-created)
-- 4. No breaking changes to Phase 13-14 functionality
-- 5. Index supports public case list queries filtering by isPublic=true and status
