import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';

/**
 * POST /api/rescue-squads/[id]/join
 *
 * Joins the current user to this squad.
 */
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const squadId = params.id;

    // Check if squad exists
    const squad = await prisma.rescueSquad.findUnique({
      where: { id: squadId },
    });

    if (!squad) {
      return NextResponse.json({ error: 'Squad not found' }, { status: 404 });
    }

    // Check if already a member
    const existingMembership = await prisma.rescueSquadMember.findFirst({
      where: {
        rescueSquadId: squadId,
        userId: session.user.id,
      },
    });

    if (existingMembership) {
      if (existingMembership.isActive) {
        return NextResponse.json({ error: 'Already a member' }, { status: 400 });
      }

      // Reactivate membership
      const updated = await prisma.rescueSquadMember.update({
        where: { id: existingMembership.id },
        data: {
          isActive: true,
          lastActiveAt: new Date(),
        },
      });

      return NextResponse.json({ membership: updated });
    }

    // Create new membership
    const membership = await prisma.rescueSquadMember.create({
      data: {
        rescueSquadId: squadId,
        userId: session.user.id,
        role: 'MEMBER',
        isActive: true,
        isOnDuty: false,
        joinedAt: new Date(),
        lastActiveAt: new Date(),
      },
    });

    // Log activity
    await prisma.squadActivity.create({
      data: {
        rescueSquadId: squadId,
        type: 'MEMBER_JOINED',
        message: 'joined the squad',
        actorId: session.user.id,
        details: JSON.stringify({}),
      },
    });

    return NextResponse.json({ membership });
  } catch (error) {
    console.error('Error joining squad:', error);
    return NextResponse.json(
      { error: 'Failed to join squad' },
      { status: 500 }
    );
  }
}
