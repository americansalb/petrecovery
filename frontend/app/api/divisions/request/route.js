import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

// POST /api/divisions/request - User submits a request to create a Division
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      rescueForceId,
      proposedName,
      justification,
      zipCodes = [],
      centerLatitude,
      centerLongitude,
      estimatedRadius,
      estimatedPopulation,
      notes,
    } = body;

    // Validate required fields
    if (!rescueForceId || !proposedName || !justification) {
      return NextResponse.json(
        { error: 'Rescue Force ID, proposed name, and justification are required' },
        { status: 400 }
      );
    }

    // Verify rescue force exists
    const rescueForce = await prisma.rescueForce.findUnique({
      where: { id: rescueForceId },
    });

    if (!rescueForce) {
      return NextResponse.json(
        { error: 'Rescue Force not found' },
        { status: 404 }
      );
    }

    // Check if user is a member of the rescue force
    const membership = await prisma.rescueForceMember.findUnique({
      where: {
        rescueForceId_userId: {
          rescueForceId,
          userId: session.user.id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'You must be a member of this Rescue Force to request a Division' },
        { status: 403 }
      );
    }

    // Check if a division with this name already exists in this force
    const existingDivision = await prisma.division.findFirst({
      where: {
        rescueForceId,
        name: proposedName,
      },
    });

    if (existingDivision) {
      return NextResponse.json(
        { error: 'A Division with this name already exists in this Rescue Force' },
        { status: 400 }
      );
    }

    // Create the division request
    const divisionRequest = await prisma.divisionRequest.create({
      data: {
        requesterId: session.user.id,
        rescueForceId,
        proposedName,
        justification,
        zipCodes: JSON.stringify(zipCodes),
        centerLatitude,
        centerLongitude,
        estimatedRadius,
        estimatedPopulation,
        notes,
        status: 'PENDING',
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
      },
    });

    return NextResponse.json(
      {
        message: 'Division request submitted successfully',
        request: divisionRequest,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating division request:', error);
    return NextResponse.json(
      { error: 'Failed to create division request' },
      { status: 500 }
    );
  }
}

// GET /api/divisions/request - Get user's division requests
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requests = await prisma.divisionRequest.findMany({
      where: {
        requesterId: session.user.id,
      },
      include: {
        requester: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        reviewedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        approvedDivision: {
          select: {
            id: true,
            name: true,
            isActive: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ requests });
  } catch (error) {
    console.error('Error fetching division requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch division requests' },
      { status: 500 }
    );
  }
}
