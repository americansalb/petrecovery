-- Migration: Update RescueSquadMemberRole enum values
-- This script migrates from old role values to new ones
-- Run this BEFORE deploying the new schema

-- Step 1: Add new enum values temporarily alongside old ones
-- (This is done via manual ALTER TYPE commands)

-- Step 2: Update all existing records to use new role values
UPDATE "RescueSquadMember"
SET role = CASE
  WHEN role = 'FOUNDER' THEN 'ADMINISTRATOR'
  WHEN role = 'LEADER' THEN 'MODERATOR'
  WHEN role = 'COORDINATOR' THEN 'MEMBER'
  ELSE role
END::text::"RescueSquadMemberRole";

-- Step 3: The schema change will then drop old enum values
-- This happens automatically when prisma db push runs with the new schema
