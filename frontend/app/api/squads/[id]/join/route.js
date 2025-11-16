import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import prisma from '../../../../lib/prisma';

// POST /api/squads/:id/join - Join a recovery squad
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

    // Get the squad
    const squad = await prisma.recoverySquad.findUnique({
      where: { id },
      include: {
        community: {
          select: {
            id: true,
            name: true
          }
        },
        report: {
          select: {
            id: true,
            petName: true
          }
        }
      }
    });

    if (!squad) {
      return NextResponse.json(
        { error: 'Squad not found' },
        { status: 404 }
      );
    }

    if (squad.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Cannot join inactive squad' },
        { status: 400 }
      );
    }

    // Check if user is a member of the community
    const membership = await prisma.communityMember.findUnique({
      where: {
        communityId_userId: {
          communityId: squad.communityId,
          userId: session.user.id
        }
      }
    });

    if (!membership || membership.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'You must be a member of this community to join the squad' },
        { status: 403 }
      );
    }

    // Check if already a member
    const existingMember = await prisma.squadMember.findUnique({
      where: {
        squadId_userId: {
          squadId: id,
          userId: session.user.id
        }
      }
    });

    if (existingMember && !existingMember.leftAt) {
      return NextResponse.json(
        { error: 'You are already a member of this squad' },
        { status: 400 }
      );
    }

    // If they previously left, allow them to rejoin
    if (existingMember && existingMember.leftAt) {
      const member = await prisma.$transaction(async (tx) => {
        // Update existing member record
        const updated = await tx.squadMember.update({
          where: { id: existingMember.id },
          data: {
            leftAt: null,
            joinedAt: new Date()
          }
        });

        // Increment member count
        await tx.recoverySquad.update({
          where: { id },
          data: {
            memberCount: {
              increment: 1
            }
          }
        });

        return updated;
      });

      return NextResponse.json({
        success: true,
        message: 'Successfully rejoined squad',
        member: {
          id: member.id,
          role: member.role
        }
      });
    }

    // Create new member
    const member = await prisma.$transaction(async (tx) => {
      const newMember = await tx.squadMember.create({
        data: {
          squadId: id,
          userId: session.user.id,
          role: 'MEMBER'
        }
      });

      // Increment member count
      await tx.recoverySquad.update({
        where: { id },
        data: {
          memberCount: {
            increment: 1
          }
        }
      });

      return newMember;
    });

    return NextResponse.json({
      success: true,
      message: 'Successfully joined squad',
      member: {
        id: member.id,
        role: member.role
      }
    });

  } catch (error) {
    console.error('Error joining squad:', error);
    return NextResponse.json(
      { error: 'Failed to join squad' },
      { status: 500 }
    );
  }
}
