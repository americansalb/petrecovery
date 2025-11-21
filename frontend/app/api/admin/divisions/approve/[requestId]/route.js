import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';

// POST /api/admin/divisions/approve/[requestId] - Approve a division request
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

    // Parse optional overrides from request body
    const body = await request.json().catch(() => ({}));
    const {
      name,
      description,
      centerLatitude,
      centerLongitude,
      radiusMiles,
      zipCodes,
    } = body;

    // Create the Division and update the request in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the Division
      const division = await tx.division.create({
        data: {
          rescueSquadId: divisionRequest.rescueSquadId,
          name: name || divisionRequest.proposedName,
          description: description || divisionRequest.notes,
          centerLatitude: centerLatitude || divisionRequest.centerLatitude,
          centerLongitude: centerLongitude || divisionRequest.centerLongitude,
          radiusMiles: radiusMiles || divisionRequest.estimatedRadius || 3,
          zipCodes: zipCodes
            ? JSON.stringify(zipCodes)
            : divisionRequest.zipCodes,
          isActive: true,
        },
      });

      // Update the request
      const updatedRequest = await tx.divisionRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          reviewedById: session.user.id,
          reviewedAt: new Date(),
          approvedDivisionId: division.id,
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
          approvedDivision: true,
        },
      });

      return { division, request: updatedRequest };
    });

    return NextResponse.json({
      message: 'Division request approved successfully',
      ...result,
    });
  } catch (error) {
    console.error('Error approving division request:', error);
    return NextResponse.json(
      { error: 'Failed to approve division request' },
      { status: 500 }
    );
  }
}
