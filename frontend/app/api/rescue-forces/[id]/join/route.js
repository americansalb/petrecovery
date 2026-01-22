import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

/**
 * POST /api/rescue-forces/[id]/join
 *
 * Joins the current user to this force.
 */
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const forceId = params.id;

    // Check if force exists and is not deleted
    const force = await prisma.rescueForce.findUnique({
      where: { id: forceId },
    });

    if (!force || force.isDeleted) {
      return NextResponse.json({ error: 'Force not found' }, { status: 404 });
    }

    // Check if already a member
    const existingMembership = await prisma.rescueForceMember.findFirst({
      where: {
        rescueForceId: forceId,
        userId: session.user.id,
      },
    });

    if (existingMembership) {
      if (existingMembership.isActive) {
        // Already a member - return success with redirect info instead of error
        return NextResponse.json({
          membership: existingMembership,
          alreadyMember: true,
          message: 'You are already a member of this force'
        });
      }

      // Reactivate membership
      const updated = await prisma.rescueForceMember.update({
        where: { id: existingMembership.id },
        data: {
          isActive: true,
          leftAt: null,
        },
      });

      return NextResponse.json({ membership: updated });
    }

    // Create new membership
    const membership = await prisma.rescueForceMember.create({
      data: {
        rescueForceId: forceId,
        userId: session.user.id,
        role: 'MEMBER',
        isActive: true,
        joinedAt: new Date(),
      },
    });

    // Log activity
    await prisma.squadActivity.create({
      data: {
        rescueForceId: forceId,
        type: 'MEMBER_JOINED',
        message: 'joined the force',
        actorId: session.user.id,
        details: JSON.stringify({}),
      },
    });

    return NextResponse.json({ membership });
  } catch (error) {
    console.error('Error joining force:', error);
    return NextResponse.json(
      { error: 'Failed to join force' },
      { status: 500 }
    );
  }
}
