import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import prisma from '../../lib/prisma';

// GET /api/communities - Browse all communities
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(request.url);

    const search = searchParams.get('search');
    const type = searchParams.get('type');
    const parentId = searchParams.get('parentId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const where = {
      isActive: true
    };

    // Filter by type
    if (type && ['METRO_AREA', 'COUNTY', 'SUBCOMMUNITY'].includes(type)) {
      where.type = type;
    }

    // Filter by parent
    if (parentId) {
      where.parentCommunityId = parentId;
    }

    // Search by name or geographic scope
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { geographicScope: { contains: search } }
      ];
    }

    console.log('🔍 Fetching communities with filter:', where);

    // Get communities with counts
    const [communities, total] = await Promise.all([
      prisma.community.findMany({
        where,
        include: {
          _count: {
            select: {
              members: {
                where: { status: 'APPROVED' }
              },
              recoverySquads: {
                where: { status: 'ACTIVE' }
              },
              subcommunities: true
            }
          },
          parentCommunity: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: limit
      }),
      prisma.community.count({ where })
    ]);

    console.log(`✅ Found ${communities.length} communities (total: ${total})`);
    if (communities.length > 0) {
      console.log('First community:', {
        id: communities[0].id,
        name: communities[0].name,
        type: communities[0].type
      });
    }

    // If user is logged in, get their membership status for each community
    let communitiesWithMembership = communities;
    if (session?.user?.id) {
      communitiesWithMembership = await Promise.all(
        communities.map(async (community) => {
          const membership = await prisma.communityMember.findUnique({
            where: {
              communityId_userId: {
                communityId: community.id,
                userId: session.user.id
              }
            },
            select: {
              status: true,
              role: true,
              isFounder: true
            }
          });

          return {
            ...community,
            userMembership: membership || null,
            memberCount: community._count.members,
            activeSquadsCount: community._count.recoverySquads,
            subcommunityCount: community._count.subcommunities
          };
        })
      );
    } else {
      communitiesWithMembership = communities.map(community => ({
        ...community,
        userMembership: null,
        memberCount: community._count.members,
        activeSquadsCount: community._count.recoverySquads,
        subcommunityCount: community._count.subcommunities
      }));
    }

    // Remove _count from response
    const cleanedCommunities = communitiesWithMembership.map(({ _count, ...community }) => community);

    return NextResponse.json({
      communities: cleanedCommunities,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching communities:', error);
    return NextResponse.json(
      { error: 'Failed to fetch communities' },
      { status: 500 }
    );
  }
}
