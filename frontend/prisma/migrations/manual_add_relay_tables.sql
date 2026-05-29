-- Manual, ADDITIVE migration: relay/connect broker tables.
--
-- WHY MANUAL: `prisma db push` currently wants to DROP reporterToLastSeenMiles
-- (12 rows) + the LocationDetectionLog table (13 rows) because the repo schema
-- has drifted from the shared remote DB. This script creates ONLY the two new
-- relay tables + enum, touching nothing else — safe to run against the live DB.
-- Idempotent (IF NOT EXISTS / guarded), so re-running is harmless.
--
-- Run with: psql "$DATABASE_URL" -f prisma/migrations/manual_add_relay_tables.sql
-- After running, `prisma generate` (with the dev server stopped so the query
-- engine DLL is unlocked) makes prisma.matchConnection / prisma.relayMessage usable.

-- Enum
DO $$ BEGIN
  CREATE TYPE "RelayStatus" AS ENUM ('OPEN', 'OWNER_REPLIED', 'MUTUAL_OPTIN', 'REJECTED', 'REUNITED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- MatchConnection
CREATE TABLE IF NOT EXISTS "MatchConnection" (
  "id"           TEXT NOT NULL,
  "token"        TEXT NOT NULL,
  "lostCaseId"   TEXT NOT NULL,
  "foundCaseId"  TEXT NOT NULL,
  "matchScore"   INTEGER NOT NULL,
  "pTrueMatch"   DOUBLE PRECISION NOT NULL,
  "matchSource"  TEXT NOT NULL,
  "status"       "RelayStatus" NOT NULL DEFAULT 'OPEN',
  "finderOptIn"  BOOLEAN NOT NULL DEFAULT false,
  "ownerOptIn"   BOOLEAN NOT NULL DEFAULT false,
  "finderHandle" TEXT NOT NULL,
  "finderTier"   INTEGER NOT NULL DEFAULT 0,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MatchConnection_pkey" PRIMARY KEY ("id")
);

-- RelayMessage
CREATE TABLE IF NOT EXISTS "RelayMessage" (
  "id"           TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "senderRole"   TEXT NOT NULL,
  "body"         TEXT NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RelayMessage_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "MatchConnection_token_key" ON "MatchConnection"("token");
CREATE INDEX IF NOT EXISTS "MatchConnection_token_idx" ON "MatchConnection"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "MatchConnection_lostCaseId_foundCaseId_key" ON "MatchConnection"("lostCaseId", "foundCaseId");
CREATE INDEX IF NOT EXISTS "RelayMessage_connectionId_idx" ON "RelayMessage"("connectionId");

-- Foreign keys (guarded so re-run is safe)
DO $$ BEGIN
  ALTER TABLE "MatchConnection" ADD CONSTRAINT "MatchConnection_lostCaseId_fkey"
    FOREIGN KEY ("lostCaseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "MatchConnection" ADD CONSTRAINT "MatchConnection_foundCaseId_fkey"
    FOREIGN KEY ("foundCaseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "RelayMessage" ADD CONSTRAINT "RelayMessage_connectionId_fkey"
    FOREIGN KEY ("connectionId") REFERENCES "MatchConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
