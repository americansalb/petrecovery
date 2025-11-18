import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';

// POST /api/rescue-squads/[id]/leave - Leave a rescue squad
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    // Check if user is a member
    const membership = await prisma.rescueSquadMember.findUnique({
      where: {
        rescueSquadId_userId: {
          rescueSquadId: id,
          userId: session.user.id,
        },
      },
    });

    if (!membership || !membership.isActive) {
      return NextResponse.json(
        { error: 'You are not a member of this squad' },
        { status: 400 }
      );
    }

    // Check if user is the founder
    if (membership.role === 'FOUNDER') {
      // Check if there are other leaders
      const otherLeaders = await prisma.rescueSquadMember.count({
        where: {
          rescueSquadId: id,
          role: 'LEADER',
          isActive: true,
        },
      });

      if (otherLeaders === 0) {
        return NextResponse.json(
          {
            error:
              'As the founder, you must promote another member to leader before leaving',
          },
          { status: 400 }
        );
      }
    }

    // Mark as inactive
    await prisma.rescueSquadMember.update({
      where: { id: membership.id },
      data: {
        isActive: false,
        leftAt: new Date(),
      },
    });

    // Opt out of all active case participations
    const activeCases = await prisma.caseParticipant.findMany({
      where: {
        userId: session.user.id,
        isActive: true,
        assignment: {
          rescueSquadId: id,
          status: { in: ['ACCEPTED', 'ACTIVE', 'STANDBY'] },
        },
      },
    });

    for (const participation of activeCases) {
      await prisma.caseParticipant.update({
        where: { id: participation.id },
        data: {
          isActive: false,
          optedOutAt: new Date(),
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error leaving squad:', error);
    return NextResponse.json(
      { error: 'Failed to leave squad' },
      { status: 500 }
    );
  }
}
