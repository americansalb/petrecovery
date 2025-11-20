import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';

// POST /api/admin/divisions/reject/[requestId] - Reject a division request
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const { requestId } = params;
    const body = await request.json();
    const { rejectionReason } = body;

    if (!rejectionReason) {
      return NextResponse.json(
        { error: 'Rejection reason is required' },
        { status: 400 }
      );
    }

    // Get the division request
    const divisionRequest = await prisma.divisionRequest.findUnique({
      where: { id: requestId },
    });

    if (!divisionRequest) {
      return NextResponse.json(
        { error: 'Division request not found' },
        { status: 404 }
      );
    }

    if (divisionRequest.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Request has already been reviewed' },
        { status: 400 }
      );
    }

    // Update the request
    const updatedRequest = await prisma.divisionRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        reviewedById: session.user.id,
        reviewedAt: new Date(),
        rejectionReason,
      },
      include: {
        requester: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        reviewedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return NextResponse.json({
      message: 'Division request rejected',
      request: updatedRequest,
    });
  } catch (error) {
    console.error('Error rejecting division request:', error);
    return NextResponse.json(
      { error: 'Failed to reject division request' },
      { status: 500 }
    );
  }
}
