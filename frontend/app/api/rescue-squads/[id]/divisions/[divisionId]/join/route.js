import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';

// POST /api/rescue-squads/:id/divisions/:divisionId/join - Join a division
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Verify division exists and belongs to the squad
    const division = await prisma.division.findUnique({
      where: { id: params.divisionId },
      include: {
        rescueSquad: true,
      },
    });

    if (!division) {
      return NextResponse.json(
        { error: 'Division not found' },
        { status: 404 }
      );
    }

    if (division.rescueSquadId !== params.id) {
      return NextResponse.json(
        { error: 'Division does not belong to this rescue squad' },
        { status: 400 }
      );
    }

    if (!division.isActive) {
      return NextResponse.json(
        { error: 'Division is not accepting new members' },
        { status: 400 }
      );
    }

    // Check if user is already a member of the parent rescue squad
    const squadMembership = await prisma.rescueSquadMember.findUnique({
      where: {
        rescueSquadId_userId: {
          rescueSquadId: params.id,
          userId: userId,
        },
      },
    });

    // If not a squad member, auto-join the squad first (as a regular MEMBER)
    if (!squadMembership) {
      await prisma.rescueSquadMember.create({
        data: {
          rescueSquadId: params.id,
          userId: userId,
          role: 'MEMBER',
          isActive: true,
        },
      });

      // Update user's rescue level if this is their first squad
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { rescueLevel: true, squadsJoinedCount: true },
      });

      if (user.rescueLevel === 'PET_OWNER') {
        await prisma.user.update({
          where: { id: userId },
          data: {
            rescueLevel: 'SCOUT',
            squadsJoinedCount: { increment: 1 },
            lastLevelUpAt: new Date(),
          },
        });
      } else {
        await prisma.user.update({
          where: { id: userId },
          data: {
            squadsJoinedCount: { increment: 1 },
          },
        });
      }
    }

    // Now update the squad membership to include division assignment
    const updatedMembership = await prisma.rescueSquadMember.update({
      where: {
        rescueSquadId_userId: {
          rescueSquadId: params.id,
          userId: userId,
        },
      },
      data: {
        divisionId: params.divisionId,
        isActive: true, // Reactivate if they had left
      },
    });

    // Update division member count
    await prisma.division.update({
      where: { id: params.divisionId },
      data: {
        totalMembers: { increment: 1 },
      },
    });

    return NextResponse.json({
      message: 'Successfully joined division',
      membership: updatedMembership,
    });
  } catch (error) {
    console.error('Error joining division:', error);

    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'You are already a member of this division' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to join division' },
      { status: 500 }
    );
  }
}
