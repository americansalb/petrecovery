const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // MIGRATION: Update legacy roles to new roles
  try {
    const membersToUpdate = await prisma.rescueSquadMember.findMany({
      where: {
        role: { in: ['FOUNDER', 'LEADER', 'COORDINATOR'] }
      }
    });

    if (membersToUpdate.length > 0) {
      console.log(`🔄 Migrating ${membersToUpdate.length} legacy roles...`);

      for (const member of membersToUpdate) {
        let newRole;
        if (member.role === 'FOUNDER') newRole = 'ADMINISTRATOR';
        else if (member.role === 'LEADER') newRole = 'MODERATOR';
        else if (member.role === 'COORDINATOR') newRole = 'MEMBER';

        if (newRole) {
          await prisma.rescueSquadMember.update({
            where: { id: member.id },
            data: { role: newRole }
          });
        }
      }

      console.log('✅ Role migration completed:');
      console.log('   FOUNDER → ADMINISTRATOR');
      console.log('   LEADER → MODERATOR');
      console.log('   COORDINATOR → MEMBER');
    }
  } catch (error) {
    console.log('ℹ️  Role migration skipped (may already be completed)');
  }

  // Check if admin user already exists
  const existingAdmin = await prisma.user.findUnique({
    where: { email: 'contact@aalb.org' }
  });

  if (existingAdmin) {
    console.log('✅ Admin user already exists');
    return;
  }

  // Hash the admin password
  const passwordHash = await bcrypt.hash('winner', 10);

  // Create admin user
  const admin = await prisma.user.create({
    data: {
      email: 'contact@aalb.org',
      passwordHash,
      firstName: 'Admin',
      role: 'ADMIN',
      emailVerified: new Date(), // Admin is pre-verified
    }
  });

  console.log('✅ Admin user created successfully');
  console.log('   Email: contact@aalb.org');
  console.log('   Password: winner');
  console.log('   Role: ADMIN');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
