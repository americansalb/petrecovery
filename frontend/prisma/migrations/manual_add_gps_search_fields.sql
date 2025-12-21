-- Manual Migration: Add GPS Search Fields
-- This migration adds fields required for GPS search session tracking
-- Run this against PostgreSQL or SQLite depending on your environment

-- Add new fields to SearchSession table
ALTER TABLE "SearchSession" ADD COLUMN IF NOT EXISTS "totalDistanceMiles" REAL DEFAULT 0;
ALTER TABLE "SearchSession" ADD COLUMN IF NOT EXISTS "validatedDistanceMiles" REAL DEFAULT 0;
ALTER TABLE "SearchSession" ADD COLUMN IF NOT EXISTS "gridCellsCovered" INTEGER DEFAULT 0;
ALTER TABLE "SearchSession" ADD COLUMN IF NOT EXISTS "lastSeenLat" REAL;
ALTER TABLE "SearchSession" ADD COLUMN IF NOT EXISTS "lastSeenLng" REAL;
ALTER TABLE "SearchSession" ADD COLUMN IF NOT EXISTS "notes" TEXT;

-- Add new fields to LocationPing table
ALTER TABLE "LocationPing" ADD COLUMN IF NOT EXISTS "speed" REAL;
ALTER TABLE "LocationPing" ADD COLUMN IF NOT EXISTS "isValid" BOOLEAN DEFAULT true;
ALTER TABLE "LocationPing" ADD COLUMN IF NOT EXISTS "invalidReason" TEXT;
ALTER TABLE "LocationPing" ADD COLUMN IF NOT EXISTS "gridCellId" TEXT;

-- Note: For SQLite, use this syntax instead (SQLite doesn't support IF NOT EXISTS for columns):
-- ALTER TABLE SearchSession ADD COLUMN totalDistanceMiles REAL DEFAULT 0;
-- ALTER TABLE SearchSession ADD COLUMN validatedDistanceMiles REAL DEFAULT 0;
-- ALTER TABLE SearchSession ADD COLUMN gridCellsCovered INTEGER DEFAULT 0;
-- ALTER TABLE SearchSession ADD COLUMN lastSeenLat REAL;
-- ALTER TABLE SearchSession ADD COLUMN lastSeenLng REAL;
-- ALTER TABLE SearchSession ADD COLUMN notes TEXT;
-- ALTER TABLE LocationPing ADD COLUMN speed REAL;
-- ALTER TABLE LocationPing ADD COLUMN isValid BOOLEAN DEFAULT 1;
-- ALTER TABLE LocationPing ADD COLUMN invalidReason TEXT;
-- ALTER TABLE LocationPing ADD COLUMN gridCellId TEXT;
