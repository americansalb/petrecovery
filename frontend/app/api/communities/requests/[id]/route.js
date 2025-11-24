import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';

// GET /api/communities/requests/:id - Get specific request details
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = params;

    const communityRequest = await prisma.communityRequest.findUnique({
      where: { id },
      include: {
        requester: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            rescueLevel: true,
            createdAt: true
          }
        },
        reviewedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        approvedCommunity: {
          select: {
            id: true,
            name: true,
            type: true
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

    // Check if user is owner or admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    const isOwner = communityRequest.requesterId === session.user.id;
    const isAdmin = user.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    return NextResponse.json({ request: communityRequest });

  } catch (error) {
    console.error('Error fetching community request:', error);
    return NextResponse.json(
      { error: 'Failed to fetch community request' },
      { status: 500 }
    );
  }
}
