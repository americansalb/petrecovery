import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

/**
 * POST /api/rescue-forces/[id]/photo
 *
 * Update force photo URL
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

    // Check if user is admin, moderator, or founder of this force
    const membership = await prisma.rescueForceMember.findFirst({
      where: {
        userId: session.user.id,
        rescueForceId: id,
        isActive: true,
      },
    });

    const allowedRoles = ['ADMIN', 'MODERATOR', 'FOUNDER'];
    if (!membership || !allowedRoles.includes(membership.role)) {
      return NextResponse.json(
        { error: 'Only admins, moderators, and founders can update force photo' },
        { status: 403 }
      );
    }

    // Update force photo
    const updatedSquad = await prisma.rescueForce.update({
      where: { id },
      data: { photoUrl },
    });

    return NextResponse.json({
      success: true,
      photoUrl: updatedSquad.photoUrl,
    });
  } catch (error) {
    console.error('[FORCE_PHOTO] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update force photo', details: error.message },
      { status: 500 }
    );
  }
}
