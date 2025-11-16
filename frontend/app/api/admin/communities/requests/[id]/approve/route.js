import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../auth/[...nextauth]/route';
import prisma from '../../../../../../lib/prisma';

// POST /api/admin/communities/requests/:id/approve - Approve community request
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    const { id } = params;
    const body = await request.json();
    const { name, description, zipCodes, centerLatitude, centerLongitude } = body;

    // Validation
    if (!name) {
      return NextResponse.json(
        { error: 'Community name is required' },
        { status: 400 }
      );
    }

    // Get the request
    const communityRequest = await prisma.communityRequest.findUnique({
      where: { id },
      include: {
        requester: true
      }
    });

    if (!communityRequest) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      );
    }

    if (communityRequest.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Request has already been reviewed' },
        { status: 400 }
      );
    }

    // Use a transaction to create community and update request
    const result = await prisma.$transaction(async (tx) => {
      // Create the community
      const community = await tx.community.create({
        data: {
          name,
          description: description || '',
          type: communityRequest.type,
          geographicScope: communityRequest.geographicScope,
          zipCodes: zipCodes ? JSON.stringify(zipCodes) : '[]',
          centerLatitude: centerLatitude || null,
          centerLongitude: centerLongitude || null,
          parentCommunityId: communityRequest.parentCommunityId || null,
          createdById: communityRequest.requesterId,
          approvedById: session.user.id,
          isActive: true
        }
      });

      // Update the request
      const updatedRequest = await tx.communityRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          reviewedById: session.user.id,
          reviewedAt: new Date(),
          approvedCommunityId: community.id
        }
      });

      // Auto-create CommunityMember for requester (founder)
      await tx.communityMember.create({
        data: {
          communityId: community.id,
          userId: communityRequest.requesterId,
          status: 'APPROVED',
          role: 'MEMBER',
          isFounder: true,
          approvedAt: new Date(),
          approvedById: session.user.id
        }
      });

      return { community, updatedRequest };
    });

    // TODO: Send approval email to requester
    console.log('Community approved:', result.community.name);

    return NextResponse.json({
      success: true,
      community: result.community
    });

  } catch (error) {
    console.error('Error approving community request:', error);
    return NextResponse.json(
      { error: 'Failed to approve community request' },
      { status: 500 }
    );
  }
}
