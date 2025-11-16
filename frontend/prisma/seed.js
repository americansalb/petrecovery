const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

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
