import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

// POST /api/communities/:id/join - Request to join community
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

    // Check if user's email or phone is verified
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { emailVerified: true, phoneVerified: true }
    });

    if (!user.emailVerified && !user.phoneVerified) {
      return NextResponse.json(
        { error: 'Email or phone verification required to join communities' },
        { status: 403 }
      );
    }

    // Get the community
    const community = await prisma.community.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        type: true,
        parentCommunityId: true
      }
    });

    if (!community) {
      return NextResponse.json(
        { error: 'Community not found' },
        { status: 404 }
      );
    }

    // Check if already a member or pending
    const existingMembership = await prisma.communityMember.findUnique({
      where: {
        communityId_userId: {
          communityId: id,
          userId: session.user.id
        }
      }
    });

    if (existingMembership) {
      if (existingMembership.status === 'BANNED') {
        return NextResponse.json(
          { error: 'You are banned from this community' },
          { status: 403 }
        );
      }
      if (existingMembership.status === 'PENDING') {
        return NextResponse.json(
          { error: 'You already have a pending join request for this community' },
          { status: 409 }
        );
      }
      if (existingMembership.status === 'APPROVED') {
        return NextResponse.json(
          { error: 'You are already a member of this community' },
          { status: 409 }
        );
      }
    }

    // If this is a subcommunity, check if user is member of parent
    if (community.type === 'SUBCOMMUNITY' && community.parentCommunityId) {
      const parentMembership = await prisma.communityMember.findUnique({
        where: {
          communityId_userId: {
            communityId: community.parentCommunityId,
            userId: session.user.id
          }
        }
      });

      if (!parentMembership || parentMembership.status !== 'APPROVED') {
        return NextResponse.json(
          { error: 'You must be a member of the parent community first' },
          { status: 403 }
        );
      }
    }

    // Create the join request
    const membership = await prisma.communityMember.create({
      data: {
        communityId: id,
        userId: session.user.id,
        status: 'PENDING',
        role: 'MEMBER'
      }
    });

    // TODO: Notify moderators of new join request

    return NextResponse.json({
      success: true,
      membership: {
        id: membership.id,
        communityId: membership.communityId,
        status: membership.status,
        requestedAt: membership.createdAt
      }
    });

  } catch (error) {
    console.error('Error joining community:', error);
    return NextResponse.json(
      { error: 'Failed to join community' },
      { status: 500 }
    );
  }
}
