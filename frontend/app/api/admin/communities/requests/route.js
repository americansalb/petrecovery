import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import prisma from '../../../../lib/prisma';

// GET /api/admin/communities/requests - Get all pending community requests for admin review
export async function GET(request) {
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

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'PENDING';
    const type = searchParams.get('type');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const where = {};

    // Filter by status
    if (['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
      where.status = status;
    }

    // Filter by type
    if (type && ['METRO_AREA', 'COUNTY', 'SUBCOMMUNITY'].includes(type)) {
      where.type = type;
    }

    console.log('🔍 Admin fetching community requests with filter:', where);

    // Get requests with requester info
    const [requests, total] = await Promise.all([
      prisma.communityRequest.findMany({
        where,
        include: {
          requester: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              emailVerified: true,
              phoneVerified: true,
              rescueLevel: true,
              createdAt: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: limit
      }),
      prisma.communityRequest.count({ where })
    ]);

    console.log(`✅ Found ${requests.length} community requests (total: ${total})`);
    if (requests.length > 0) {
      console.log('First request:', {
        id: requests[0].id,
        type: requests[0].type,
        geographicScope: requests[0].geographicScope,
        status: requests[0].status
      });
    }

    // For each request, get additional metadata
    const requestsWithMetadata = await Promise.all(
      requests.map(async (req) => {
        // Get community count for requester
        let communityCount = 0;
        try {
          communityCount = await prisma.communityMember.count({
            where: {
              userId: req.requesterId,
              status: 'APPROVED'
            }
          });
        } catch (e) {
          console.error('Error counting communities:', e);
        }

        // Get approved community if exists
        let approvedCommunity = null;
        if (req.approvedCommunityId) {
          try {
            approvedCommunity = await prisma.community.findUnique({
              where: { id: req.approvedCommunityId },
              select: { id: true, name: true }
            });
          } catch (e) {
            console.error('Error fetching approved community:', e);
          }
        }

        // Get reviewer if exists
        let reviewedBy = null;
        if (req.reviewedById) {
          try {
            reviewedBy = await prisma.user.findUnique({
              where: { id: req.reviewedById },
              select: { id: true, firstName: true, lastName: true }
            });
          } catch (e) {
            console.error('Error fetching reviewer:', e);
          }
        }

        return {
          ...req,
          requester: {
            ...req.requester,
            communityCount
          },
          approvedCommunity,
          reviewedBy,
          overlapCheck: {
            hasOverlap: false,
            overlappingCommunities: []
          }
        };
      })
    );

    return NextResponse.json({
      requests: requestsWithMetadata,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching admin community requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch community requests' },
      { status: 500 }
    );
  }
}
