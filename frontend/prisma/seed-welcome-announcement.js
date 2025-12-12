/**
 * Seed script to create a welcome announcement from Sarama (mascot)
 * for all existing rescue squads
 *
 * Run with: node prisma/seed-welcome-announcement.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const WELCOME_MESSAGE = `Welcome to your local Rescue Squad! 🐾

We're a community of caring neighbors who work together to help lost pets find their way home.

Here's how you can help:
• Keep an eye out for lost pet alerts in your area
• Share sightings and updates with fellow members
• Join search parties when pets go missing nearby
• Post encouraging messages to support pet owners

Every share, every search, every kind word makes a difference. Together, we bring pets home!`;

async function seedWelcomeAnnouncements() {
  console.log('Seeding welcome announcements for all rescue squads...');

  // Get all active rescue squads
  const squads = await prisma.rescueSquad.findMany({
    where: { isActive: true },
    select: { id: true, city: true },
  });

  console.log(`Found ${squads.length} active squads`);

  // Find or create a system user for Sarama
  let systemUser = await prisma.user.findFirst({
    where: { email: 'sarama@petrecovery.app' },
  });

  if (!systemUser) {
    systemUser = await prisma.user.create({
      data: {
        email: 'sarama@petrecovery.app',
        firstName: 'Sarama',
        lastName: '',
        role: 'ADMIN',
      },
    });
    console.log('Created system user for Sarama');
  }

  let created = 0;
  let skipped = 0;

  for (const squad of squads) {
    // Check if welcome announcement already exists
    const existing = await prisma.squadActivity.findFirst({
      where: {
        rescueSquadId: squad.id,
        type: 'ANNOUNCEMENT',
        message: { contains: 'Welcome to your local Rescue Squad' },
      },
    });

    if (existing) {
      console.log(`  Skipping ${squad.city} - already has welcome announcement`);
      skipped++;
      continue;
    }

    // Create the welcome announcement
    await prisma.squadActivity.create({
      data: {
        rescueSquadId: squad.id,
        actorId: systemUser.id,
        type: 'ANNOUNCEMENT',
        message: WELCOME_MESSAGE,
        details: JSON.stringify({
          title: 'Welcome to Your Rescue Squad!',
          isPinned: true,
          isSystemPost: true,
        }),
      },
    });

    console.log(`  Created welcome announcement for ${squad.city}`);
    created++;
  }

  console.log(`\nDone! Created ${created} announcements, skipped ${skipped}`);
}

seedWelcomeAnnouncements()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
