import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import prisma from '../../../../lib/prisma';

// POST /api/squads/:id/leave - Leave a recovery squad
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = params;

    // Get the squad member record
    const member = await prisma.squadMember.findUnique({
      where: {
        squadId_userId: {
          squadId: id,
          userId: session.user.id
        }
      }
    });

    if (!member) {
      return NextResponse.json(
        { error: 'You are not a member of this squad' },
        { status: 404 }
      );
    }

    if (member.leftAt) {
      return NextResponse.json(
        { error: 'You have already left this squad' },
        { status: 400 }
      );
    }

    // Pet owner cannot leave their own squad
    if (member.role === 'OWNER') {
      return NextResponse.json(
        { error: 'Pet owner cannot leave their own squad. Close the squad instead.' },
        { status: 403 }
      );
    }

    // Mark as left and decrement member count
    await prisma.$transaction(async (tx) => {
      await tx.squadMember.update({
        where: { id: member.id },
        data: {
          leftAt: new Date()
        }
      });

      await tx.recoverySquad.update({
        where: { id },
        data: {
          memberCount: {
            decrement: 1
          }
        }
      });
    });

    return NextResponse.json({
      success: true,
      message: 'Successfully left squad'
    });

  } catch (error) {
    console.error('Error leaving squad:', error);
    return NextResponse.json(
      { error: 'Failed to leave squad' },
      { status: 500 }
    );
  }
}
