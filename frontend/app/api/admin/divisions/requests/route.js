import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

// GET /api/admin/divisions/requests - Get all division requests for admin review
export async function GET(request) {
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

    // Get filter from query params
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'PENDING';

    const requests = await prisma.divisionRequest.findMany({
      where: {
        status: status === 'ALL' ? undefined : status,
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
        approvedDivision: {
          select: {
            id: true,
            name: true,
            isActive: true,
            totalMembers: true,
            activeMissions: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Enhance with rescue force info
    const requestsWithSquadInfo = await Promise.all(
      requests.map(async (req) => {
        const squad = await prisma.rescueSquad.findUnique({
          where: { id: req.rescueSquadId },
          select: {
            id: true,
            name: true,
            _count: {
              select: {
                members: true,
                divisions: true,
              },
            },
          },
        });

        return {
          ...req,
          rescueSquad: squad,
        };
      })
    );

    return NextResponse.json({ requests: requestsWithSquadInfo });
  } catch (error) {
    console.error('Error fetching division requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch division requests' },
      { status: 500 }
    );
  }
}
