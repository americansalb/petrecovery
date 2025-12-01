import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/rescue-squads/[id]/photo
 *
 * Update squad photo URL
 * Requires ADMIN or MODERATOR role
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

    // Check if user is admin or moderator of this squad
    const membership = await prisma.rescueSquadMembership.findUnique({
      where: {
        userId_rescueSquadId: {
          userId: session.user.id,
          rescueSquadId: id,
        },
      },
    });

    if (!membership || (membership.role !== 'ADMIN' && membership.role !== 'MODERATOR')) {
      return NextResponse.json(
        { error: 'Only admins and moderators can update squad photo' },
        { status: 403 }
      );
    }

    // Update squad photo
    const updatedSquad = await prisma.rescueSquad.update({
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
      { error: 'Failed to update squad photo' },
      { status: 500 }
    );
  }
}
