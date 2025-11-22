import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';

// POST /api/admin/communities/requests/:id/reject - Reject community request
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
    const { reason } = body;

    if (!reason) {
      return NextResponse.json(
        { error: 'Rejection reason is required' },
        { status: 400 }
      );
    }

    // Get the request
    const communityRequest = await prisma.communityRequest.findUnique({
      where: { id },
      include: {
        requester: {
          select: {
            email: true,
            firstName: true
          }
        }
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

    // Update the request
    const updatedRequest = await prisma.communityRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewedById: session.user.id,
        reviewedAt: new Date(),
        rejectionReason: reason
      },
      include: {
        reviewedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    // TODO: Send rejection email to requester with reason
    console.log('Community request rejected:', updatedRequest.id);

    return NextResponse.json({
      success: true,
      request: updatedRequest
    });

  } catch (error) {
    console.error('Error rejecting community request:', error);
    return NextResponse.json(
      { error: 'Failed to reject community request' },
      { status: 500 }
    );
  }
}
