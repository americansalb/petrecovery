const { PrismaClient } = require('@prisma/client');
const { TERMS_OF_SERVICE_DOC } = require('./legal/terms-of-service');
const { LIABILITY_WAIVER_DOC } = require('./legal/liability-waiver');
const { PRIVACY_POLICY_DOC } = require('./legal/privacy-policy');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // ============================================================================
  // ADMIN USER
  // ============================================================================

  // Admin seed credentials must NEVER be a repo literal (a hardcoded
  // password lands in git history and, when seeded onto a shared DB, becomes a
  // known-credential backdoor admin). Take them from env, or generate a strong
  // random password and print it ONCE.
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'contact@aalb.org';
  let adminPassword = process.env.SEED_ADMIN_PASSWORD;
  let generatedPassword = false;
  if (!adminPassword) {
    adminPassword = crypto.randomBytes(18).toString('base64url'); // ~24 chars, high entropy
    generatedPassword = true;
  }

  // Check if admin user already exists
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail }
  });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        firstName: 'Admin',
        role: 'ADMIN',
        emailVerified: new Date(), // Admin is pre-verified
      }
    });

    console.log('✅ Admin user created successfully');
    console.log(`   Email: ${adminEmail}`);
    if (generatedPassword) {
      console.log(`   Password (generated, shown once - store it now): ${adminPassword}`);
    } else {
      console.log('   Password: (from SEED_ADMIN_PASSWORD env)');
    }
    console.log('   Role: ADMIN');
  } else {
    console.log('ℹ️  Admin user already exists');
  }

  // ============================================================================
  // LEGAL DOCUMENTS (Phase 0)
  // ============================================================================

  const legalDocuments = [
    TERMS_OF_SERVICE_DOC,
    LIABILITY_WAIVER_DOC,
    PRIVACY_POLICY_DOC,
  ];

  for (const doc of legalDocuments) {
    const existing = await prisma.legalDocument.findUnique({
      where: { slug: doc.slug }
    });

    if (!existing) {
      await prisma.legalDocument.create({ data: doc });
      console.log(`✅ Created ${doc.title} (v${doc.version})`);
    } else if (existing.version !== doc.version) {
      await prisma.legalDocument.update({
        where: { slug: doc.slug },
        data: {
          version: doc.version,
          title: doc.title,
          summary: doc.summary,
          content: doc.content,
          publishedAt: new Date(),
        },
      });
      console.log(`⬆️  Updated ${doc.title} (v${existing.version} → v${doc.version})`);
    } else {
      console.log(`ℹ️  ${doc.title} already current (v${doc.version})`);
    }
  }

  console.log('🌱 Database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
