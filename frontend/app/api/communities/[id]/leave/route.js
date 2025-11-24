import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';

// POST /api/communities/:id/leave - Leave community
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

    // Get the membership
    const membership = await prisma.communityMember.findUnique({
      where: {
        communityId_userId: {
          communityId: id,
          userId: session.user.id
        }
      }
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'You are not a member of this community' },
        { status: 404 }
      );
    }

    if (membership.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'You are not an active member of this community' },
        { status: 400 }
      );
    }

    // Get community name for response
    const community = await prisma.community.findUnique({
      where: { id },
      select: { name: true }
    });

    // Delete the membership
    await prisma.communityMember.delete({
      where: {
        communityId_userId: {
          communityId: id,
          userId: session.user.id
        }
      }
    });

    // TODO: Remove from active recovery squads in this community

    return NextResponse.json({
      success: true,
      message: `Left ${community.name}`
    });

  } catch (error) {
    console.error('Error leaving community:', error);
    return NextResponse.json(
      { error: 'Failed to leave community' },
      { status: 500 }
    );
  }
}
