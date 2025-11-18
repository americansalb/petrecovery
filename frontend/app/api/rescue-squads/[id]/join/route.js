import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';

// POST /api/rescue-squads/[id]/join - Join a rescue squad
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    // Check if squad exists and is active
    const squad = await prisma.rescueSquad.findUnique({
      where: { id },
    });

    if (!squad) {
      return NextResponse.json({ error: 'Squad not found' }, { status: 404 });
    }

    if (!squad.isActive) {
      return NextResponse.json(
        { error: 'This squad is not currently active' },
        { status: 400 }
      );
    }

    // Check if already a member
    const existingMembership = await prisma.rescueSquadMember.findUnique({
      where: {
        rescueSquadId_userId: {
          rescueSquadId: id,
          userId: session.user.id,
        },
      },
    });

    if (existingMembership) {
      if (existingMembership.isActive) {
        return NextResponse.json(
          { error: 'You are already a member of this squad' },
          { status: 400 }
        );
      }

      // Reactivate membership
      const membership = await prisma.rescueSquadMember.update({
        where: { id: existingMembership.id },
        data: {
          isActive: true,
          leftAt: null,
        },
        include: {
          rescueSquad: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      return NextResponse.json({ membership });
    }

    // Create new membership
    const membership = await prisma.rescueSquadMember.create({
      data: {
        rescueSquadId: id,
        userId: session.user.id,
        role: 'MEMBER',
        isActive: true,
      },
      include: {
        rescueSquad: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    // Update user stats
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        squadsJoinedCount: { increment: 1 },
        // Level up to SCOUT if this is first squad
        ...(user.rescueLevel === 'PET_OWNER' && { rescueLevel: 'SCOUT' }),
      },
    });

    return NextResponse.json({ membership }, { status: 201 });
  } catch (error) {
    console.error('Error joining squad:', error);
    return NextResponse.json(
      { error: 'Failed to join squad' },
      { status: 500 }
    );
  }
}
