import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';

// POST /api/rescue-squads/:id/join - Join a rescue squad
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const squad = await prisma.rescueSquad.findUnique({
      where: { id: params.id },
    });

    if (!squad) {
      return NextResponse.json(
        { error: 'Rescue squad not found' },
        { status: 404 }
      );
    }

    if (!squad.isAcceptingMembers) {
      return NextResponse.json(
        { error: 'This rescue squad is not currently accepting new members' },
        { status: 400 }
      );
    }

    // Check if already a member
    const existingMembership = await prisma.rescueSquadMember.findFirst({
      where: {
        rescueSquadId: params.id,
        userId: session.user.id,
      },
    });

    if (existingMembership) {
      if (existingMembership.isActive) {
        return NextResponse.json(
          { error: 'You are already a member of this squad' },
          { status: 400 }
        );
      } else {
        // Re-activate existing membership
        await prisma.rescueSquadMember.update({
          where: { id: existingMembership.id },
          data: {
            isActive: true,
            joinedAt: new Date(),
          },
        });

        return NextResponse.json({
          message: 'Successfully rejoined the squad',
        });
      }
    }

    // Create new membership
    await prisma.rescueSquadMember.create({
      data: {
        rescueSquadId: params.id,
        userId: session.user.id,
        role: 'MEMBER',
        isActive: true,
      },
    });

    // Update user's squad count
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        squadsJoinedCount: { increment: 1 },
      },
    });

    return NextResponse.json({
      message: 'Successfully joined the squad',
    });
  } catch (error) {
    console.error('Error joining rescue squad:', error);
    return NextResponse.json(
      { error: 'Failed to join rescue squad' },
      { status: 500 }
    );
  }
}
