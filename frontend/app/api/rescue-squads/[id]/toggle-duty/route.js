import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

/**
 * POST /api/rescue-squads/[id]/toggle-duty
 *
 * Toggles the current user's on-duty status for this squad.
 */
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const squadId = params.id;

    // Find user's membership
    const membership = await prisma.rescueSquadMember.findFirst({
      where: {
        rescueSquadId: squadId,
        userId: session.user.id,
        isActive: true,
      },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Not a rescue force member' }, { status: 403 });
    }

    // Toggle availability status (AVAILABLE = on duty, BUSY = off duty)
    const newStatus = membership.availabilityStatus === 'AVAILABLE' ? 'BUSY' : 'AVAILABLE';
    const updated = await prisma.rescueSquadMember.update({
      where: { id: membership.id },
      data: {
        availabilityStatus: newStatus,
      },
    });

    // Log activity
    const isOnDuty = updated.availabilityStatus === 'AVAILABLE';
    await prisma.squadActivity.create({
      data: {
        rescueSquadId: squadId,
        type: isOnDuty ? 'MEMBER_OPTED_IN' : 'MEMBER_OPTED_OUT',
        message: isOnDuty ? 'went on duty' : 'went off duty',
        actorId: session.user.id,
        details: JSON.stringify({}),
      },
    });

    return NextResponse.json({
      isOnDuty: isOnDuty,
    });
  } catch (error) {
    console.error('Error toggling duty status:', error);
    return NextResponse.json(
      { error: 'Failed to toggle duty status' },
      { status: 500 }
    );
  }
}
