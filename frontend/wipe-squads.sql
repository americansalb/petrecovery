-- Wipe all rescue squad data
-- Run this with: npx prisma db execute --file wipe-squads.sql --schema prisma/schema.prisma

-- Delete case participants that belong to squad assignments
DELETE FROM "CaseParticipant"
WHERE "assignmentId" IN (
  SELECT id FROM "CaseAssignment" WHERE "rescueSquadId" IS NOT NULL
);

-- Delete all case assignments
DELETE FROM "CaseAssignment";

-- Delete all squad members
DELETE FROM "RescueSquadMember";

-- Delete all divisions
DELETE FROM "Division";

-- Delete all rescue squads
DELETE FROM "RescueSquad";

-- Show counts
SELECT 'All rescue squad data deleted successfully' as message;
