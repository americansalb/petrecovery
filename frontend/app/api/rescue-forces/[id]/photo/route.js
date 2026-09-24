import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

/**
 * POST /api/rescue-forces/[id]/photo
 *
 * Update squad photo URL
 * Requires ADMIN, MODERATOR, or FOUNDER role
 */
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = params;
    const body = await request.json();
    const { photoUrl } = body;

    if (!photoUrl) {
      return NextResponse.json(
        { error: 'Photo URL is required' },
        { status: 400 }
      );
    }

    // Founders and leaders manage the force (the settings page's rule).
    // This allowed 'ADMIN', 'MODERATOR' and 'FOUNDER': 'ADMIN' is not a force
    // role, and leaders, who can edit everything else, could not change it.
    const membership = await prisma.rescueForceMember.findFirst({
      where: {
        userId: session.user.id,
        rescueSquadId: id,
        isActive: true,
      },
    });

    const allowedRoles = ['FOUNDER', 'LEADER', 'ADMINISTRATOR'];
    if (!membership || !allowedRoles.includes(membership.role)) {
      return NextResponse.json(
        { error: 'Only founders and leaders can change the rescue force photo' },
        { status: 403 }
      );
    }

    // Update squad photo
    const updatedSquad = await prisma.rescueForce.update({
      where: { id },
      data: { photoUrl },
    });

    return NextResponse.json({
      success: true,
      photoUrl: updatedSquad.photoUrl,
    });
  } catch (error) {
    console.error('[SQUAD_PHOTO] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update rescue force photo', details: error.message },
      { status: 500 }
    );
  }
}
