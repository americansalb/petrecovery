import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

const WELCOME_MESSAGE = `Welcome to your local Rescue Squad!

We're a community of caring neighbors who work together to help lost pets find their way home.

Here's how you can help:
• Keep an eye out for lost pet alerts in your area
• Share sightings and updates with fellow members
• Join search parties when pets go missing nearby
• Post encouraging messages to support pet owners

Every share, every search, every kind word makes a difference. Together, we bring pets home!`;

/**
 * POST /api/admin/seed-welcome
 * Seeds welcome announcements for all squads that don't have one
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);

    // Allow anyone to run this for now (in production, require admin)
    // if (!session || session.user.role !== 'ADMIN') {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    // Get all active rescue squads
    const squads = await prisma.rescueSquad.findMany({
      where: { isActive: true },
      select: { id: true, city: true },
    });

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

      created++;
    }

    return NextResponse.json({
      success: true,
      message: `Created ${created} welcome announcements, skipped ${skipped} (already exist)`,
      created,
      skipped,
    });
  } catch (error) {
    console.error('Error seeding welcome announcements:', error);
    return NextResponse.json(
      { error: 'Failed to seed welcome announcements', details: error.message },
      { status: 500 }
    );
  }
}
