// Migration script: Update RescueSquadMemberRole enum values
// Run this BEFORE deploying the new schema with: node scripts/migrate-roles.js

const { PrismaClient } = require('@prisma/client');

async function migrateRoles() {
  const prisma = new PrismaClient();

  try {
    console.log('Starting role migration...');

    // Use raw SQL to update enum values
    // This must happen before the schema change
    await prisma.$executeRaw`
      UPDATE "RescueSquadMember"
      SET role = CASE
        WHEN role = 'FOUNDER' THEN 'ADMINISTRATOR'::text
        WHEN role = 'LEADER' THEN 'MODERATOR'::text
        WHEN role = 'COORDINATOR' THEN 'MEMBER'::text
        ELSE role::text
      END::"RescueSquadMemberRole"
    `;

    console.log('✓ Role migration completed successfully');
    console.log('  FOUNDER → ADMINISTRATOR');
    console.log('  LEADER → MODERATOR');
    console.log('  COORDINATOR → MEMBER');

  } catch (error) {
    console.error('Error migrating roles:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

migrateRoles();
